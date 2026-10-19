import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Payment,
  PaymentReceipt,
  PayosCheckout,
} from "../../../../generated/prisma/client";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import { AuditWriter } from "../../../audit/application/audit-writer";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import { ApplicationEventsService } from "../../../application-events/application/application-events.service";
import { PayosTransport } from "../../infrastructure/payos-transport";
import type { GatewayPaymentEvent } from "../contracts/payment-gateway";
import { paymentTime } from "../../domain/payment-time";
import { isTechnicalReviewReason } from "../../domain/payment-recovery-policy";

export function quoteDigest(
  payment: Pick<
    Payment,
    | "id"
    | "userId"
    | "paymentAmountVnd"
    | "creditAmount"
    | "conversionRateVndPerCredit"
  >,
  checkout: Pick<
    PayosCheckout,
    | "channel"
    | "orderCode"
    | "expiresAt"
    | "returnUrl"
    | "cancelUrl"
    | "policyVersion"
  >,
) {
  return fingerprintCommand({
    paymentId: payment.id,
    userId: payment.userId,
    amount: payment.paymentAmountVnd.toString(),
    credit: payment.creditAmount.toString(),
    conversionRate: payment.conversionRateVndPerCredit,
    channel: checkout.channel,
    orderCode: checkout.orderCode.toString(),
    expiresAt: checkout.expiresAt.toISOString(),
    returnUrl: checkout.returnUrl,
    cancelUrl: checkout.cancelUrl,
    policy: checkout.policyVersion,
  });
}

@Injectable()
export class PaymentReceiptsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly transport: PayosTransport,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
    private readonly events: ApplicationEventsService,
  ) {}

  async webhook(body: unknown) {
    return this.accept(this.transport.gateway.verifyWebhook(body));
  }

  accept(event: GatewayPaymentEvent) {
    return this.transactions.run(async (tx) => {
      // A bank transaction belongs to exactly one receipt, including unknown/sample orders.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${event.eventKey},0))`;
      const receipt = await tx.paymentReceipt.findUnique({
        where: {
          channel_transactionId: {
            channel: event.channel,
            transactionId: event.transactionId,
          },
        },
      });
      if (receipt) {
        return this.duplicate(tx, receipt, event);
      }
      const candidate = await tx.payosCheckout.findUnique({
        where: { orderCode: BigInt(event.orderCode) },
      });
      const checkout = candidate?.channel === event.channel ? candidate : null;
      if (checkout)
        await tx.$queryRaw`SELECT payment_id FROM payments WHERE payment_id=${checkout.paymentId}::uuid FOR UPDATE`;
      const payment = checkout
        ? await tx.payment.findUniqueOrThrow({
            where: { id: checkout.paymentId },
          })
        : null;
      const current = checkout
        ? await tx.payosCheckout.findUniqueOrThrow({
            where: { paymentId: checkout.paymentId },
          })
        : null;
      const reason = await this.validationReason(tx, event, payment, current);
      const receiptId = randomUUID();
      await tx.paymentReceipt.create({
        data: {
          id: receiptId,
          channel: event.channel,
          transactionId: event.transactionId,
          digest: event.businessDigest,
          evidence: event,
          paymentId: payment?.id,
          state: reason ? "REVIEW" : "POSTED",
          reason,
        },
      });
      if (reason || !payment || !current) {
        if (payment)
          await this.review(tx, payment.id, reason ?? "PAYMENT_ORDER_UNKNOWN");
        return { duplicate: false, posted: false };
      }
      const posted = await this.credit.topUp(tx, {
        userId: payment.userId,
        paymentId: payment.id,
        amount: payment.creditAmount,
        receiptDigest: event.businessDigest,
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", gatewayTransactionId: event.transactionId },
      });
      const updated = await tx.payosCheckout.update({
        where: { paymentId: payment.id },
        data: {
          paymentLinkId: event.paymentLinkId,
          state: "CLOSED",
          paidAt: paymentTime(event.transactionDateTime),
          topUpOperationId: posted.operationId,
          qrCode: null,
          lastError: null,
          version: { increment: 1 },
        },
      });
      const source = randomUUID();
      await this.audit.append(tx, {
        actor: { kind: "SYSTEM", name: "payos-payment" },
        action: "CREDIT_TOP_UP",
        target: { type: "PAYMENT", id: payment.id },
        reason: "Verified exact payOS payment",
        after: {
          amount: payment.creditAmount.toString(),
          balanceBefore: posted.before.toString(),
          balanceAfter: posted.after.toString(),
          operationId: posted.operationId,
          referenceId: payment.id,
        },
        context: { requestId: source, correlationId: source },
      });
      await this.events.append(
        tx,
        [payment.userId],
        source,
        "payment.updated",
        {
          paymentId: payment.id,
          status: "PAID",
          version: String(updated.version),
        },
      );
      await this.events.append(
        tx,
        [payment.userId],
        randomUUID(),
        "wallet.updated",
        { walletUserId: payment.userId, operationId: posted.operationId },
      );
      return { duplicate: false, posted: true };
    });
  }

  private async duplicate(
    tx: TransactionContext,
    receipt: PaymentReceipt,
    event: GatewayPaymentEvent,
  ) {
    if (receipt.digest !== event.businessDigest) {
      await tx.paymentFinding.upsert({
        where: {
          receiptId_digest: {
            receiptId: receipt.id,
            digest: event.businessDigest,
          },
        },
        create: {
          receiptId: receipt.id,
          digest: event.businessDigest,
          evidence: event,
          reason: "PAYMENT_RECEIPT_CONFLICT",
        },
        update: {},
      });
      await tx.paymentReceipt.update({
        where: { id: receipt.id },
        data: { conflict: true },
      });
      if (receipt.paymentId)
        await this.review(tx, receipt.paymentId, "PAYMENT_RECEIPT_CONFLICT");
    }
    return {
      duplicate: true,
      posted:
        receipt.digest === event.businessDigest && receipt.state === "POSTED",
    };
  }

  private async validationReason(
    tx: TransactionContext,
    event: GatewayPaymentEvent,
    payment: Payment | null,
    checkout: PayosCheckout | null,
  ) {
    const reason = this.rejection(event, payment, checkout);
    if (reason || !payment) return reason ?? "PAYMENT_ORDER_UNKNOWN";
    if (
      await tx.payment.findFirst({
        where: { gateway: "PAYOS", gatewayTransactionId: event.transactionId },
      })
    )
      return "PAYMENT_TRANSACTION_CONFLICT";
    try {
      await this.credit.lockWallet(tx, payment.userId);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      return "CREDIT_PROVENANCE_REVIEW_REQUIRED";
    }
    return null;
  }

  private rejection(
    event: GatewayPaymentEvent,
    payment: Payment | null,
    checkout: PayosCheckout | null,
  ): string | null {
    if (!payment || !checkout || checkout.channel !== event.channel)
      return "PAYMENT_ORDER_UNKNOWN";
    if (payment.status === "PAID") return "PAYMENT_ALREADY_PAID";
    if (payment.status === "REVIEW") return "PAYMENT_REVIEW_REQUIRED";
    if (payment.status === "CANCELLED") return "PAYMENT_CANCELLED";
    if (event.outcome !== "PAID" || event.currency !== "VND")
      return "PAYMENT_OUTCOME_UNSUPPORTED";
    if (quoteDigest(payment, checkout) !== checkout.quoteDigest)
      return "PAYMENT_QUOTE_MISMATCH";
    if (payment.paymentAmountVnd !== BigInt(event.amountVnd))
      return "PAYMENT_AMOUNT_MISMATCH";
    if (
      checkout.paymentLinkId &&
      checkout.paymentLinkId !== event.paymentLinkId
    )
      return "PAYMENT_LINK_MISMATCH";
    const time = paymentTime(event.transactionDateTime);
    if (
      !time ||
      time.getTime() < Math.floor(payment.createdAt.getTime() / 1000) * 1000 ||
      time > checkout.expiresAt ||
      time.getTime() > Date.now() + 60000
    )
      return "PAYMENT_TIME_REVIEW_REQUIRED";
    return null;
  }

  async canRecoverReview(
    tx: TransactionContext,
    payment: Payment,
    checkout: PayosCheckout,
  ) {
    if (
      payment.gateway !== "PAYOS" ||
      payment.status !== "REVIEW" ||
      checkout.state !== "REVIEW" ||
      !isTechnicalReviewReason(checkout.lastError) ||
      !payment.creationKeyDigest ||
      !payment.creationFingerprint ||
      payment.gatewayTransactionId ||
      checkout.paidAt ||
      checkout.topUpOperationId
    )
      return false;
    return !(await tx.paymentReceipt.findFirst({
      where: { paymentId: payment.id },
      select: { id: true },
    }));
  }

  /** Called only after authenticated lookup of the original immutable quote. */
  resumeTechnicalReview(
    paymentId: string,
    leaseToken: string,
    paymentLinkId: string,
  ) {
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT payment_id FROM payments WHERE payment_id=${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      const checkout = await tx.payosCheckout.findUniqueOrThrow({
        where: { paymentId },
      });
      if (
        checkout.leaseToken !== leaseToken ||
        checkout.channel !==
          (this.transport.config.enabled
            ? this.transport.config.PAYOS_CLIENT_ID
            : "") ||
        quoteDigest(payment, checkout) !== checkout.quoteDigest ||
        (checkout.paymentLinkId && checkout.paymentLinkId !== paymentLinkId) ||
        !(await this.canRecoverReview(tx, payment, checkout))
      )
        return false;
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "CREATED" },
      });
      const updated = await tx.payosCheckout.update({
        where: { paymentId },
        data: {
          state: "PREPARING",
          paymentLinkId,
          lastError: "PAYMENT_RECOVERY_PENDING",
          version: { increment: 1 },
        },
      });
      const source = randomUUID();
      await this.audit.append(tx, {
        actor: { kind: "SYSTEM", name: "payos-recovery" },
        action: "PAYMENT_RECOVERY_RESUME",
        target: { type: "PAYMENT", id: paymentId },
        reason: "Resume technical review after verified payOS lookup",
        before: {
          status: "REVIEW",
          reasonCode: checkout.lastError,
          version: checkout.version,
        },
        after: {
          status: "CREATED",
          reasonCode: updated.lastError,
          version: updated.version,
        },
        context: { requestId: source, correlationId: source },
      });
      await this.events.append(
        tx,
        [payment.userId],
        source,
        "payment.updated",
        {
          paymentId,
          status: "CREATED",
          version: String(updated.version),
        },
      );
      return true;
    });
  }

  async review(tx: TransactionContext, paymentId: string, reason: string) {
    await tx.$queryRaw`SELECT payment_id FROM payments WHERE payment_id=${paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (payment.status === "PAID") return;
    if (payment.status === "REVIEW") {
      const current = await tx.payosCheckout.findUniqueOrThrow({
        where: { paymentId },
      });
      // Financial evidence must make an old technical review ineligible for automatic resume.
      if (
        !isTechnicalReviewReason(current.lastError) ||
        current.lastError === reason
      )
        return;
    }
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REVIEW" },
    });
    const checkout = await tx.payosCheckout.update({
      where: { paymentId },
      data: {
        state: "REVIEW",
        lastError: reason,
        qrCode: null,
        version: { increment: 1 },
      },
    });
    await this.events.append(
      tx,
      [payment.userId],
      randomUUID(),
      "payment.updated",
      { paymentId, status: "REVIEW", version: String(checkout.version) },
    );
  }
}
