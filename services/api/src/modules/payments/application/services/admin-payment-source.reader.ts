import { Prisma } from "../../../../generated/prisma/client";
import {
  adminWorkSourceQuery,
  type AdminWorkSourcePage,
} from "../../../administration/application/contracts/admin-work-source-page";
import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminPaymentReaderPort,
  type AdminPaymentWorkRow,
} from "../ports/admin-payment.reader";

@Injectable()
export class AdminPaymentSourceReader extends AdminPaymentReaderPort {
  reviewWork(tx: TransactionContext, page: AdminWorkSourcePage) {
    return tx.$queryRaw<AdminPaymentWorkRow[]>(
      adminWorkSourceQuery(
        Prisma.sql`SELECT
        payment_id AS id,
        status::text AS status,
        created_at AS "createdAt",
        created_at AS "receivedAt",
        'Payment ' || left(payment_id::text, 8) AS title,
        NULL::text AS reason,
        'UNCLASSIFIED'::text AS severity,
        NULL::uuid AS assignee
      FROM payments WHERE status = 'REVIEW'`,
        "PAYMENT_REVIEW",
        page,
      ),
    );
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
