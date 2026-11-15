import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { AdminVerificationReaderPort } from "../ports/admin-verification.reader";

@Injectable()
export class AdminVerificationSourceReader extends AdminVerificationReaderPort {
  pendingWork(
    tx: TransactionContext,
    page: { receivedAt?: Date; order: "asc" | "desc"; take: number },
  ) {
    return tx.skillVerification.findMany({
      where: {
        status: "PENDING",
        ...(page.receivedAt
          ? {
              submittedAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ submittedAt: page.order }, { id: "asc" }],
      take: page.take,
      select: {
        id: true,
        sharingSkillId: true,
        status: true,
        reviewerId: true,
        note: true,
        submittedAt: true,
        version: true,
      },
    });
  }

  detail(tx: TransactionContext, id: string) {
    return tx.skillVerification.findUnique({
      where: { id },
      select: {
        id: true,
        sharingSkillId: true,
        status: true,
        reviewerId: true,
        note: true,
        submittedAt: true,
        version: true,
      },
    });
  }

  pendingCount(tx: TransactionContext) {
    return tx.skillVerification.count({ where: { status: "PENDING" } });
  }
}
