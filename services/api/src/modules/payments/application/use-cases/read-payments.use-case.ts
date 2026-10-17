import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  Payment,
  PayosCheckout,
  PaymentStatus,
} from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { formatCredit } from "../../../credit/domain/money";
import { LedgerCursor } from "../../../credit/domain/ledger-cursor";

export class PaymentCursor extends LedgerCursor {}
function view(payment: Payment, checkout: PayosCheckout | null) {
  const showQr =
    payment.status === "PENDING" &&
    checkout?.state === "READY" &&
    checkout.expiresAt > new Date() &&
    !!checkout.qrCode;
  return {
    id: payment.id,
    gateway: payment.gateway,
    status: payment.status,
    paymentAmountVnd: payment.paymentAmountVnd.toString(),
    currency: payment.currency,
    creditAmount: formatCredit(payment.creditAmount),
    conversionRateVndPerCredit: payment.conversionRateVndPerCredit,
    createdAt: payment.createdAt,
    expiresAt: checkout?.expiresAt ?? null,
    paidAt: checkout?.paidAt ?? null,
    version: checkout?.version ?? 1,
    checkout: showQr
      ? {
          paymentLinkId: checkout.paymentLinkId,
          orderCode: checkout.orderCode.toString(),
          qrCode: checkout.qrCode,
          providerStatus: "PENDING",
        }
      : null,
  };
}
@Injectable()
export class ReadPaymentsUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly cursors: PaymentCursor,
  ) {}
  detail(principal: Principal, id: string) {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
      const payment = await tx.payment.findFirst({
        where: { id, userId: principal.userId },
      });
      if (!payment) throw new NotFoundException("PAYMENT_NOT_FOUND");
      return view(
        payment,
        await tx.payosCheckout.findUnique({ where: { paymentId: id } }),
      );
    });
  }
  list(
    principal: Principal,
    query: { limit: number; cursor?: string; status?: PaymentStatus },
  ) {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
      const scope = { userId: principal.userId, type: query.status };
      const boundary = query.cursor
        ? this.cursors.decode(query.cursor, scope)
        : {
            watermark:
              (
                await tx.payosCheckout.findFirst({
                  where: { payment: { userId: principal.userId } },
                  orderBy: { orderCode: "desc" },
                  select: { orderCode: true },
                })
              )?.orderCode ?? 0n,
          };
      const rows = await tx.payosCheckout.findMany({
        where: {
          payment: { userId: principal.userId, status: query.status },
          orderCode: {
            lte: boundary.watermark,
            ...("before" in boundary ? { lt: boundary.before } : {}),
          },
        },
        orderBy: { orderCode: "desc" },
        take: query.limit + 1,
        include: { payment: true },
      });
      const visible = rows.slice(0, query.limit),
        last = visible.at(-1),
        hasMore = rows.length > query.limit;
      return {
        data: visible.map((row) => view(row.payment, row)),
        pagination: {
          limit: query.limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? this.cursors.encode(scope, boundary.watermark, last.orderCode)
              : null,
        },
      };
    });
  }
}
