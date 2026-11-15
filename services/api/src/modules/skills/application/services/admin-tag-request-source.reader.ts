import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { AdminTagRequestReaderPort } from "../ports/admin-tag-request.reader";

@Injectable()
export class AdminTagRequestSourceReader extends AdminTagRequestReaderPort {
  pendingWork(
    tx: TransactionContext,
    page: { receivedAt?: Date; order: "asc" | "desc"; take: number },
  ) {
    return tx.tagCreationRequest.findMany({
      where: {
        status: "PENDING",
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
      select: {
        id: true,
        label: true,
        status: true,
        requestedByUserId: true,
        reviewedByUserId: true,
        createdAt: true,
        version: true,
      },
    });
  }

  detail(tx: TransactionContext, id: string) {
    return tx.tagCreationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        status: true,
        requestedByUserId: true,
        reviewedByUserId: true,
        createdAt: true,
        version: true,
      },
    });
  }

  pendingCount(tx: TransactionContext) {
    return tx.tagCreationRequest.count({ where: { status: "PENDING" } });
  }
}
