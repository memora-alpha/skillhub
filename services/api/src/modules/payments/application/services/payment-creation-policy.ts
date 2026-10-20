import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { PayosTransport } from "../../infrastructure/gateway/payos-transport";

const unresolved = ["CREATED", "PENDING", "REVIEW"] as const;
export type PaymentCreationDecision = {
  canCreate: boolean;
  reasonCode: string | null;
  existingPaymentId: string | null;
};

@Injectable()
export class PaymentCreationPolicy {
  constructor(private readonly transport: PayosTransport) {}

  async read(
    tx: TransactionContext,
    userId: string,
  ): Promise<PaymentCreationDecision> {
    const config = this.transport.config;
    if (!config.enabled) return this.blocked("PAYMENT_PROVIDER_UNAVAILABLE");
    if (config.creationPaused) return this.blocked("PAYMENT_CREATION_PAUSED");
    // Never expose another owner's ID when a channel switch strands old orders.
    const oldChannel = await tx.payosCheckout.findFirst({
      where: {
        channel: { not: config.PAYOS_CLIENT_ID },
        payment: { status: { in: [...unresolved] } },
      },
      select: { paymentId: true },
    });
    if (oldChannel)
      return this.blocked("PAYMENT_CHANNEL_RECONCILIATION_REQUIRED");
    const pending = await tx.payment.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: [...unresolved] } },
          { gateway: "PAYOS", creationKeyDigest: null },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, creationKeyDigest: true },
    });
    if (pending)
      return this.blocked(
        pending.creationKeyDigest
          ? "PAYMENT_UNRESOLVED"
          : "PAYMENT_RECONCILIATION_REQUIRED",
        pending.id,
      );
    return { canCreate: true, reasonCode: null, existingPaymentId: null };
  }

  async requireFresh(tx: TransactionContext, userId: string) {
    const decision = await this.read(tx, userId);
    if (decision.canCreate) return;
    if (decision.existingPaymentId)
      throw new ConflictException({
        message: decision.reasonCode,
        existingPaymentId: decision.existingPaymentId,
      });
    throw new ServiceUnavailableException(decision.reasonCode!);
  }

  private blocked(
    reasonCode: string,
    existingPaymentId: string | null = null,
  ): PaymentCreationDecision {
    return { canCreate: false, reasonCode, existingPaymentId };
  }
}
