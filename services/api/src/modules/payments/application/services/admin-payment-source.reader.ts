import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminPaymentReaderPort,
  type AdminSourcePage,
} from "../ports/admin-payment.reader";

@Injectable()
export class AdminPaymentSourceReader extends AdminPaymentReaderPort {
  reviewWork(tx: TransactionContext, page: AdminSourcePage) {
    return tx.payment.findMany({
      where: {
        status: "REVIEW",
        ...(page.receivedAt
          ? {
              createdAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ createdAt: page.order }, { id: "asc" }],
      take: page.take,
      select: { id: true, status: true, createdAt: true },
    });
  }

  reviewDetail(tx: TransactionContext, id: string) {
    return tx.payment.findUnique({
      where: { id },
      select: {
        status: true,
        creditAmount: true,
        paymentAmountVnd: true,
        currency: true,
        gateway: true,
        createdAt: true,
      },
    });
  }

  reviewCount(tx: TransactionContext) {
    return tx.payment.count({ where: { status: "REVIEW" } });
  }
}
