import { Injectable, NotFoundException } from "@nestjs/common";
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
import type { AdminLedgerQueryDto } from "../../presentation/http/admin-finance.dto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Prisma } from "../../../../generated/prisma/client";
import { formatCredit } from "../../domain/money";

const entrySelect = {
  id: true,
  userId: true,
  operationId: true,
  type: true,
  status: true,
  createdAt: true,
  amount: true,
  availableDelta: true,
  heldDelta: true,
  availableAfter: true,
  heldAfter: true,
  reversesTransactionId: true,
  operationIdRecord: {
    select: { referenceType: true, referenceId: true, operationType: true },
  },
} satisfies Prisma.CreditTransactionSelect;
type Entry = Prisma.CreditTransactionGetPayload<{ select: typeof entrySelect }>;
export function adminLedgerView(row: Entry) {
  return {
    ...row,
    amount: formatCredit(row.amount),
    availableDelta: formatCredit(row.availableDelta),
    heldDelta: formatCredit(row.heldDelta),
    availableAfter: formatCredit(row.availableAfter),
    heldAfter: formatCredit(row.heldAfter),
  };
}
@Injectable()
export class AdminCreditReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly config: IdentityConfig,
  ) {}
  private read<T>(
    actor: Principal,
    work: (tx: TransactionContext) => Promise<T>,
  ) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      requireFinanceAdmin(
        await this.sessions.assertLive(tx, actor),
        "credit:read:any",
      );
      return work(tx);
    });
  }
  list(actor: Principal, query: AdminLedgerQueryDto) {
    const { cursor, ...filter } = query;
    const codec = financeCursor(
      this.config.jwtKey,
      financeScope(actor.userId, "ledger", filter),
    );
    const boundary = codec.decode(cursor);
    const createdAt = adminTimeRange(query.from, query.to);
    return this.read(actor, async (tx) => {
      const rows = await tx.creditTransaction.findMany({
        where: {
          userId: query.userId,
          type: query.type,
          status: query.status,
          operationId: query.operationId,
          operationIdRecord: {
            referenceType: query.referenceType,
            referenceId: query.referenceId,
          },
          createdAt,
          ...adminBefore(boundary),
        },
        select: entrySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
      });
      const data = rows.slice(0, query.limit),
        last = data.at(-1);
      return {
        data: data.map(adminLedgerView),
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
    return this.read(actor, async (tx) => {
      const row = await tx.creditTransaction.findUnique({
        where: { id },
        select: entrySelect,
      });
      if (!row) throw new NotFoundException("CREDIT_TRANSACTION_NOT_FOUND");
      return adminLedgerView(row);
    });
  }
  operation(actor: Principal, id: string) {
    return this.read(actor, async (tx) => {
      const operation = await tx.creditOperation.findUnique({
        where: { id },
        select: {
          id: true,
          operationType: true,
          referenceType: true,
          referenceId: true,
          status: true,
          createdAt: true,
        },
      });
      if (!operation) throw new NotFoundException("CREDIT_OPERATION_NOT_FOUND");
      const entries = await tx.creditTransaction.findMany({
        where: { operationId: id },
        select: entrySelect,
        orderBy: { entryNo: "asc" },
      });
      return { ...operation, entries: entries.map(adminLedgerView) };
    });
  }
  wallet(actor: Principal, userId: string) {
    return this.read(actor, async (tx) => {
      const wallet = await tx.creditWallet.findUnique({
        where: { userId },
        select: {
          userId: true,
          availableCredit: true,
          heldCredit: true,
          walletVersion: true,
        },
      });
      if (!wallet) throw new NotFoundException("WALLET_NOT_FOUND");
      return {
        ...wallet,
        availableCredit: formatCredit(wallet.availableCredit),
        heldCredit: formatCredit(wallet.heldCredit),
      };
    });
  }
}
