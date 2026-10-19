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

/** Durable checkout rows are the queue; a fenced lease permits multiple API instances. */
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
          state: { in: ["PREPARING", "READY"] },
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
        !["CREATED", "PENDING"].includes(payment.status) ||
        checkout.channel !==
          (this.transport.config.enabled
            ? this.transport.config.PAYOS_CLIENT_ID
            : "") ||
        !["PREPARING", "READY"].includes(checkout.state) ||
        (checkout.leaseUntil && checkout.leaseUntil > new Date()) ||
        (!cancelling && checkout.nextAttemptAt > new Date())
      )
        return null;
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
      if (invalid || checkout.attempts >= 5) {
        const reason = invalid
          ? "PAYMENT_PROVIDER_EVIDENCE_INVALID"
          : "PAYMENT_PROVIDER_RETRY_EXHAUSTED";
        await this.finish(paymentId, leaseToken, { review: reason });
      } else await this.finish(paymentId, leaseToken, { retry: true });
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
      const lookup = await this.transport.cancel({
        orderCode: checkout.orderCode.toString(),
        paymentAmountVnd: payment.paymentAmountVnd,
        expiresAt: checkout.expiresAt,
      });
      await this.applyLookup(checkout, leaseToken, lookup, false);
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
      checkout.expiresAt <= new Date()
    ) {
      if (await this.resume(checkout, leaseToken, quote)) return;
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
        checkout.state === "READY" ||
        checkout.expiresAt <= new Date()
      )
        throw error;
      return false;
    }
    return this.applyLookup(checkout, leaseToken, lookup, true);
  }

  private closedStatus(status: string): "CANCELLED" | "EXPIRED" | undefined {
    if (status === "CANCELLED" || status === "EXPIRED") return status;
    return undefined;
  }

  private async applyLookup(
    checkout: PayosCheckout,
    leaseToken: string,
    lookup: Awaited<ReturnType<PayosTransport["lookup"]>>,
    allowLocalExpiry: boolean,
  ) {
    const paymentId = checkout.paymentId;
    if (lookup.events.length) {
      if (!lookup.exact || lookup.status !== "PAID") {
        // Retain every authenticated bank reference, but aggregate mismatches can never issue Credit.
        for (const event of lookup.events)
          await this.receipts.accept({ ...event, outcome: "REVIEW" });
        await this.finish(paymentId, leaseToken, {
          review: "PAYMENT_PARTIAL_OR_MULTIPLE_TRANSACTIONS",
        });
        return true;
      }
      const accepted = await this.receipts.accept(lookup.events[0]!);
      await this.finish(
        paymentId,
        leaseToken,
        accepted.posted ? {} : { review: "PAYMENT_RECEIPT_REVIEW_REQUIRED" },
      );
      return true;
    }
    if (lookup.status === "PAID" || lookup.hasPayment) {
      await this.finish(paymentId, leaseToken, {
        review: "PAYMENT_TRANSACTION_EVIDENCE_MISSING",
      });
      return true;
    }
    let closed = this.closedStatus(lookup.status);
    if (!closed && allowLocalExpiry && checkout.expiresAt <= new Date())
      closed = "EXPIRED";
    if (!closed && !checkout.qrCode) {
      await this.finish(paymentId, leaseToken, {
        review: "PAYMENT_QR_UNAVAILABLE",
      });
      return true;
    }
    await this.finish(paymentId, leaseToken, {
      paymentLinkId: lookup.paymentLinkId,
      closed,
    });
    return true;
  }

  private finish(
    paymentId: string,
    leaseToken: string,
    result: {
      paymentLinkId?: string;
      qrCode?: string;
      closed?: "CANCELLED" | "EXPIRED";
      retry?: boolean;
      review?: string;
    },
  ) {
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
            lastError: "PAYMENT_PROVIDER_UNAVAILABLE",
            nextAttemptAt: new Date(
              Date.now() + Math.min(300000, 15000 * 2 ** checkout.attempts),
            ),
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
}
