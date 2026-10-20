import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { PayosTransport } from "../../infrastructure/payos-transport";
import {
  PaymentReceiptsService,
  quoteDigest,
} from "./payment-receipts.service";
import { ApplicationEventsService } from "../../../application-events/application/application-events.service";
import type {
  Payment,
  PayosCheckout,
} from "../../../../generated/prisma/client";
import type { CheckoutQuote } from "../contracts/payment-gateway";
import {
  isTechnicalReviewReason,
  technicalReviewReasons,
} from "../../domain/payment-recovery-policy";

/** Durable checkout rows are the queue; a fenced lease permits multiple API instances. */
type FinishResult = {
  paymentLinkId?: string;
  qrCode?: string;
  closed?: "CANCELLED" | "EXPIRED";
  retry?: boolean;
  retryReason?: string;
  review?: string;
};

@Injectable()
export class PaymentCheckoutWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PaymentCheckoutWorker.name);
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly transport: PayosTransport,
    private readonly receipts: PaymentReceiptsService,
    private readonly events: ApplicationEventsService,
  ) {}
  onModuleInit() {
    if (!this.transport.config.enabled) return;
    this.timer = setInterval(() => {
      void this.recover().catch(() =>
        this.logger.error("PAYMENT_RECOVERY_UNAVAILABLE"),
      );
    }, 15000);
    this.timer.unref();
    void this.recover().catch(() =>
      this.logger.error("PAYMENT_RECOVERY_UNAVAILABLE"),
    );
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async recover() {
    if (this.running || !this.transport.config.enabled) return;
    this.running = true;
    try {
      const due = await this.db.payosCheckout.findMany({
        where: {
          channel: this.transport.config.PAYOS_CLIENT_ID,
          AND: [
            {
              OR: [
                {
                  state: { in: ["PREPARING", "READY"] },
                  payment: { status: { in: ["CREATED", "PENDING"] } },
                },
                {
                  state: "REVIEW",
                  lastError: { in: [...technicalReviewReasons] },
                  payment: { status: "REVIEW" },
                },
              ],
            },
          ],
          nextAttemptAt: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        orderBy: { nextAttemptAt: "asc" },
        take: 20,
        select: { paymentId: true },
      });
      // Bounded sequential requests avoid a recovery burst against the merchant API.
      for (const row of due)
        await this.process(row.paymentId).catch(() =>
          this.logger.warn({
            event: "payment.recovery.deferred",
            paymentId: row.paymentId,
          }),
        );
    } finally {
      this.running = false;
    }
  }

  private claim(paymentId: string, leaseToken: string, cancelling = false) {
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT payment_id FROM payments WHERE payment_id=${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      const checkout = await tx.payosCheckout.findUnique({
        where: { paymentId },
      });
      const technicalReview =
        !cancelling &&
        payment?.status === "REVIEW" &&
        checkout?.state === "REVIEW" &&
        isTechnicalReviewReason(checkout.lastError);
      if (cancelling && !checkout)
        throw new ConflictException("PAYMENT_RECONCILIATION_REQUIRED");
      if (
        cancelling &&
        checkout?.channel !==
          (this.transport.config.enabled
            ? this.transport.config.PAYOS_CLIENT_ID
            : "")
      )
        throw new ServiceUnavailableException("PAYMENT_CHANNEL_UNAVAILABLE");
      if (
        !payment ||
        !checkout ||
        (!technicalReview &&
          !["CREATED", "PENDING"].includes(payment.status)) ||
        checkout.channel !==
          (this.transport.config.enabled
            ? this.transport.config.PAYOS_CLIENT_ID
            : "") ||
        (!technicalReview &&
          !["PREPARING", "READY"].includes(checkout.state)) ||
        (checkout.leaseUntil && checkout.leaseUntil > new Date()) ||
        (!cancelling && checkout.nextAttemptAt > new Date())
      )
        return null;
      if (
        technicalReview &&
        !(await this.receipts.canRecoverReview(tx, payment, checkout))
      ) {
        await this.receipts.review(
          tx,
          paymentId,
          "PAYMENT_RECONCILIATION_REQUIRED",
        );
        return null;
      }
      if (quoteDigest(payment, checkout) !== checkout.quoteDigest) {
        await this.receipts.review(tx, paymentId, "PAYMENT_QUOTE_MISMATCH");
        return null;
      }
      await tx.payosCheckout.update({
        where: { paymentId },
        data: {
          leaseToken,
          leaseUntil: new Date(Date.now() + 30000),
          attempts: { increment: 1 },
        },
      });
      return { payment, checkout };
    });
  }

  async process(paymentId: string) {
    if (!this.transport.config.enabled) return;
    const leaseToken = randomUUID();
    const claimed = await this.claim(paymentId, leaseToken);
    if (!claimed) return;
    const { payment, checkout } = claimed;
    try {
      await this.prepare(payment, checkout, leaseToken);
    } catch (error) {
      const invalid =
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException;
      if (invalid)
        await this.finish(paymentId, leaseToken, {
          review: "PAYMENT_PROVIDER_EVIDENCE_INVALID",
        });
      else {
        await this.finish(paymentId, leaseToken, { retry: true });
        if (checkout.attempts >= 5)
          this.logger.warn({ event: "payment.recovery.delayed", paymentId });
      }
    }
  }

  async cancel(paymentId: string) {
    if (!this.transport.config.enabled)
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    const leaseToken = randomUUID();
    const claimed = await this.claim(paymentId, leaseToken, true);
    if (!claimed) throw new ConflictException("PAYMENT_CHECKOUT_BUSY");
    const { payment, checkout } = claimed;
    try {
      // The existing fenced checkout lease excludes create/recovery I/O. A crash
      // after payOS cancellation is recovered by signed lookup of this same order.
      const quote = {
        orderCode: checkout.orderCode.toString(),
        paymentAmountVnd: payment.paymentAmountVnd,
        expiresAt: checkout.expiresAt,
      };
      const lookup = await this.transport.cancel(quote);
      await this.applyLookup(checkout, leaseToken, lookup, quote, false);
    } catch (error) {
      const invalid =
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException;
      await this.finish(
        paymentId,
        leaseToken,
        invalid
          ? { review: "PAYMENT_PROVIDER_EVIDENCE_INVALID" }
          : { retry: true },
      );
      throw new ServiceUnavailableException("PAYMENT_CANCELLATION_UNCONFIRMED");
    }
  }

  private async prepare(
    payment: Payment,
    checkout: PayosCheckout,
    leaseToken: string,
  ) {
    const paymentId = payment.id;
    const quote = {
      orderCode: checkout.orderCode.toString(),
      paymentAmountVnd: payment.paymentAmountVnd,
      expiresAt: checkout.expiresAt,
    };
    if (
      checkout.attempts > 0 ||
      checkout.state === "READY" ||
      payment.status === "REVIEW" ||
      checkout.expiresAt <= new Date()
    ) {
      if (await this.resume(payment, checkout, leaseToken, quote)) return;
    }
    const descriptor = await this.transport.create(quote, checkout);
    await this.finish(paymentId, leaseToken, {
      paymentLinkId: descriptor.paymentLinkId,
      qrCode:
        descriptor.providerStatus === "PENDING" ? descriptor.qrCode : undefined,
      closed: this.closedStatus(descriptor.providerStatus),
    });
  }

  private async resume(
    payment: Payment,
    checkout: PayosCheckout,
    leaseToken: string,
    quote: CheckoutQuote,
  ) {
    let lookup;
    try {
      lookup = await this.transport.lookup(quote);
    } catch (error) {
      // Retry the immutable provider-unique orderCode after an ambiguous create.
      // Established orders are only looked up. No provider I/O happens inside a DB transaction.
      if (
        !(error instanceof ServiceUnavailableException) ||
        payment.status === "REVIEW" ||
        checkout.paymentLinkId ||
        checkout.state === "READY" ||
        checkout.expiresAt <= new Date()
      )
        throw error;
      return false;
    }
    if (
      checkout.paymentLinkId &&
      checkout.paymentLinkId !== lookup.paymentLinkId
    )
      throw new BadRequestException("PAYMENT_LINK_MISMATCH");
    if (
      payment.status === "REVIEW" &&
      !(await this.receipts.resumeTechnicalReview(
        payment.id,
        leaseToken,
        lookup.paymentLinkId,
      ))
    )
      return true;
    return this.applyLookup(checkout, leaseToken, lookup, quote, true);
  }

  private closedStatus(status: string): "CANCELLED" | "EXPIRED" | undefined {
    if (status === "CANCELLED" || status === "EXPIRED") return status;
    return undefined;
  }

  private async applyLookup(
    checkout: PayosCheckout,
    leaseToken: string,
    lookup: Awaited<ReturnType<PayosTransport["lookup"]>>,
    quote: CheckoutQuote,
    allowAutomaticCancel: boolean,
  ): Promise<boolean> {
    const paymentId = checkout.paymentId;
    if (
      checkout.paymentLinkId &&
      checkout.paymentLinkId !== lookup.paymentLinkId
    )
      throw new BadRequestException("PAYMENT_LINK_MISMATCH");
    if (lookup.events.length) {
      await this.applyLookupEvents(paymentId, leaseToken, lookup);
      return true;
    }
    if (lookup.status === "PAID" || lookup.hasPayment) {
      await this.finish(paymentId, leaseToken, {
        review: "PAYMENT_TRANSACTION_EVIDENCE_MISSING",
      });
      return true;
    }
    const closed = this.closedStatus(lookup.status);
    if (
      !closed &&
      (!checkout.qrCode ||
        checkout.expiresAt <= new Date() ||
        lookup.status === "PROCESSING")
    ) {
      if (allowAutomaticCancel && lookup.status === "PENDING") {
        // Lookup does not return QR. Close this same unpaid order before allowing
        // a fresh key; a timeout or the local clock alone never proves closure.
        const cancelled = await this.transport.cancel(
          quote,
          "Checkout recovery: QR unavailable or expired",
        );
        return this.applyLookup(
          { ...checkout, paymentLinkId: lookup.paymentLinkId },
          leaseToken,
          cancelled,
          quote,
          false,
        );
      }
      await this.finish(paymentId, leaseToken, {
        retry: true,
        retryReason:
          lookup.status === "PROCESSING"
            ? "PAYMENT_PROVIDER_PROCESSING"
            : "PAYMENT_PROVIDER_UNAVAILABLE",
      });
      return true;
    }
    await this.finish(paymentId, leaseToken, {
      paymentLinkId: lookup.paymentLinkId,
      closed,
    });
    return true;
  }

  private async applyLookupEvents(
    paymentId: string,
    leaseToken: string,
    lookup: Awaited<ReturnType<PayosTransport["lookup"]>>,
  ) {
    if (!lookup.exact || lookup.status !== "PAID") {
      // Retain every authenticated bank reference, but aggregate mismatches can never issue Credit.
      for (const event of lookup.events)
        await this.receipts.accept({ ...event, outcome: "REVIEW" });
      await this.finish(paymentId, leaseToken, {
        review: "PAYMENT_PARTIAL_OR_MULTIPLE_TRANSACTIONS",
      });
      return;
    }
    const accepted = await this.receipts.accept(lookup.events[0]!);
    await this.finish(
      paymentId,
      leaseToken,
      accepted.posted ? {} : { review: "PAYMENT_RECEIPT_REVIEW_REQUIRED" },
    );
  }

  private finish(paymentId: string, leaseToken: string, result: FinishResult) {
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT payment_id FROM payments WHERE payment_id=${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      const checkout = await tx.payosCheckout.findUniqueOrThrow({
        where: { paymentId },
      });
      if (checkout.leaseToken !== leaseToken) return;
      await tx.payosCheckout.update({
        where: { paymentId },
        data: { leaseToken: null, leaseUntil: null },
      });
      if (payment.status === "REVIEW") {
        await this.finishTechnicalReview(tx, checkout, result);
        return;
      }
      if (!["CREATED", "PENDING"].includes(payment.status)) return;
      if (
        result.paymentLinkId &&
        checkout.paymentLinkId &&
        result.paymentLinkId !== checkout.paymentLinkId
      )
        result = { review: "PAYMENT_LINK_MISMATCH" };
      if (result.review) {
        await this.receipts.review(tx, paymentId, result.review);
        return;
      }
      if (result.retry) {
        await tx.payosCheckout.update({
          where: { paymentId },
          data: {
            lastError: result.retryReason ?? "PAYMENT_PROVIDER_UNAVAILABLE",
            nextAttemptAt: this.nextAttempt(checkout.attempts),
          },
        });
        return;
      }
      const status = result.closed ?? "PENDING";
      const changed = payment.status !== status || !!result.qrCode;
      await tx.payment.update({ where: { id: paymentId }, data: { status } });
      const updated = await tx.payosCheckout.update({
        where: { paymentId },
        data: {
          state: result.closed ? "CLOSED" : "READY",
          paymentLinkId: result.paymentLinkId,
          qrCode: result.closed ? null : result.qrCode,
          attempts: 0,
          lastError: null,
          nextAttemptAt: new Date(Date.now() + 60000),
          version: { increment: changed ? 1 : 0 },
        },
      });
      if (changed)
        await this.events.append(
          tx,
          [payment.userId],
          randomUUID(),
          "payment.updated",
          { paymentId, status, version: String(updated.version) },
        );
    });
  }

  /** A technical review may still be refined by its own checkout retry/review result. */
  private async finishTechnicalReview(
    tx: TransactionContext,
    checkout: PayosCheckout,
    result: FinishResult,
  ) {
    if (!isTechnicalReviewReason(checkout.lastError)) return;
    const { paymentId } = checkout;
    if (result.review) await this.receipts.review(tx, paymentId, result.review);
    else if (result.retry)
      await tx.payosCheckout.update({
        where: { paymentId },
        data: { nextAttemptAt: this.nextAttempt(checkout.attempts) },
      });
  }

  private nextAttempt(attempts: number) {
    return new Date(
      Date.now() + Math.min(300000, 15000 * 2 ** Math.min(attempts, 5)),
    );
  }
}
