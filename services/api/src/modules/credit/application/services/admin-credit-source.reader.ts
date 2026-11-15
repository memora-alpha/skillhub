import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminCreditReaderPort,
  type AdminCreditWindow,
} from "../ports/admin-credit.reader";

@Injectable()
export class AdminCreditSourceReader extends AdminCreditReaderPort {
  settlementWork(
    tx: TransactionContext,
    page: { receivedAt?: Date; order: "asc" | "desc"; take: number },
  ) {
    return tx.pathSettlementAttempt.findMany({
      where: {
        errorCode: { not: null },
        ...(page.receivedAt
          ? {
              checkedAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ checkedAt: page.order }, { pathId: "asc" }],
      take: page.take,
      select: {
        pathId: true,
        checkedAt: true,
        attemptCount: true,
        outcome: true,
        errorCode: true,
      },
    });
  }

  settlementDetail(tx: TransactionContext, pathId: string) {
    return tx.pathSettlementAttempt.findUnique({
      where: { pathId },
      select: {
        pathId: true,
        checkedAt: true,
        attemptCount: true,
        outcome: true,
        errorCode: true,
      },
    });
  }

  async summary(tx: TransactionContext, window: AdminCreditWindow) {
    const [topUp, held, feeRows] = await Promise.all([
      tx.creditTransaction.aggregate({
        where: {
          type: "TOP_UP",
          status: "SUCCESS",
          createdAt: { gte: window.from, lt: window.to },
        },
        _sum: { amount: true },
      }),
      tx.creditWallet.aggregate({ _sum: { heldCredit: true } }),
      tx.$queryRaw<{ collected: bigint; refunded: bigint }[]>`
        WITH collected AS (
          SELECT COALESCE(SUM(t.amount),0)::bigint AS amount
          FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
          WHERE t.type='PLATFORM_FEE' AND t.status='SUCCESS' AND o.status='SUCCESS'
            AND t.created_at >= ${window.from} AND t.created_at < ${window.to}
        ), refunded AS (
          SELECT COALESCE(SUM(t.available_delta),0)::bigint AS amount
          FROM credit_operations o JOIN credit_transactions t ON t.operation_id=o.operation_id
          WHERE o.operation_type='MATERIAL_REFUND' AND o.status='SUCCESS' AND t.status='SUCCESS'
            AND o.created_at >= ${window.from} AND o.created_at < ${window.to}
        ) SELECT collected.amount AS collected, refunded.amount AS refunded FROM collected, refunded`,
    ]);
    const fees = feeRows[0] ?? { collected: 0n, refunded: 0n };
    return {
      topUpCredit: topUp._sum.amount ?? 0n,
      heldCredit: held._sum.heldCredit ?? 0n,
      collectedCredit: fees.collected,
      refundedCredit: fees.refunded,
    };
  }

  topUps(tx: TransactionContext, window: AdminCreditWindow) {
    return tx.creditTransaction.findMany({
      where: {
        type: "TOP_UP",
        status: "SUCCESS",
        createdAt: { gte: window.from, lt: window.to },
      },
      select: { createdAt: true, amount: true },
    });
  }
}
