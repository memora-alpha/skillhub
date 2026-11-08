import { Injectable, NotFoundException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import { IdentityConfig } from "../../../../configs/identity.config";
import {
  adminBefore,
  adminTimeRange,
  financeCursor,
  financeScope,
  requireFinanceAdmin,
} from "../../../../shared/http/admin-finance-page";
import { formatCredit } from "../../../credit/domain/money";
import { PaymentReconciliationReader } from "./payment-reconciliation.reader";
import type { AdminPaymentQueryDto } from "../../presentation/http/admin-payments.controller";
import type { Prisma } from "../../../../generated/prisma/client";

const paymentSelect = {
  id: true,
  userId: true,
  status: true,
  creditAmount: true,
  paymentAmountVnd: true,
  currency: true,
  gateway: true,
  externalOrderRef: true,
  gatewayTransactionId: true,
  createdAt: true,
  conversionRateVndPerCredit: true,
  payosCheckout: {
    select: {
      state: true,
      orderCode: true,
      paidAt: true,
      expiresAt: true,
      topUpOperationId: true,
    },
  },
} satisfies Prisma.PaymentSelect;
type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;
export function adminPaymentView(row: PaymentRow) {
  return {
    ...row,
    creditAmount: formatCredit(row.creditAmount),
    paymentAmountVnd: row.paymentAmountVnd.toString(),
    payosCheckout: row.payosCheckout
      ? {
          ...row.payosCheckout,
          orderCode: row.payosCheckout.orderCode.toString(),
        }
      : null,
  };
}
@Injectable()
export class AdminPaymentsReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly config: IdentityConfig,
    private readonly reconciliation: PaymentReconciliationReader,
  ) {}
  private read<T>(
    actor: Principal,
    permission: string,
    work: (tx: TransactionContext) => Promise<T>,
  ) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      requireFinanceAdmin(
        await this.sessions.assertLive(tx, actor),
        permission,
      );
      return work(tx);
    });
  }
  list(actor: Principal, query: AdminPaymentQueryDto) {
    const { cursor, ...filter } = query;
    const codec = financeCursor(
      this.config.jwtKey,
      financeScope(actor.userId, "payments", filter),
    );
    const boundary = codec.decode(cursor),
      createdAt = adminTimeRange(query.from, query.to);
    return this.read(actor, "payment:read:any", async (tx) => {
      const rows = await tx.payment.findMany({
        where: {
          userId: query.userId,
          status: query.status,
          externalOrderRef: query.orderCode,
          gatewayTransactionId: query.gatewayTransactionId,
          createdAt,
          ...adminBefore(boundary),
        },
        select: paymentSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
      });
      const data = rows.slice(0, query.limit),
        last = data.at(-1);
      return {
        data: data.map(adminPaymentView),
        pagination: {
          limit: query.limit,
          hasMore: rows.length > query.limit,
          nextCursor:
            rows.length > query.limit && last ? codec.encode(last) : null,
        },
      };
    });
  }
  detail(actor: Principal, id: string) {
    return this.read(actor, "payment:read:any", async (tx) => {
      const row = await tx.payment.findUnique({
        where: { id },
        select: paymentSelect,
      });
      if (!row) throw new NotFoundException("PAYMENT_NOT_FOUND");
      return adminPaymentView(row);
    });
  }
  async report(actor: Principal, id: string) {
    await this.read(actor, "payment:reconcile", async (tx) => {
      if (
        !(await tx.payment.findUnique({ where: { id }, select: { id: true } }))
      )
        throw new NotFoundException("PAYMENT_NOT_FOUND");
    });
    // Existing reconciliation is read-only; no recovery or provider lookup on this GET.
    const result = await this.reconciliation.report(
      { paymentId: id, limit: 100 },
      false,
    );
    return {
      ...result,
      records: result.records.map((record) => ({
        paymentId: record.paymentId,
        userId: record.userId,
        status: record.status,
        paymentAmountVnd: record.paymentAmountVnd,
        orderCode: record.orderCode,
        currentChannelMatches: record.currentChannelMatches,
        topUpOperationIds: record.topUpOperationIds,
        findings: record.findings,
        provider: record.provider,
      })),
    };
  }
}
