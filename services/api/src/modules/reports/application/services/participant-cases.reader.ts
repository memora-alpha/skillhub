import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
@Injectable()
export class ParticipantCasesReader {
  batch(tx: TransactionContext, viewerId: string, pathIds: string[]) {
    return tx.reportCase.findMany({
      where: {
        relatedPathId: { in: pathIds },
        relatedPathIdRecord: {
          OR: [{ participantAId: viewerId }, { participantBId: viewerId }],
        },
      },
      select: {
        id: true,
        relatedPathId: true,
        relatedSessionId: true,
        reasonCode: true,
        status: true,
        blocksSettlement: true,
        createdAt: true,
        resolvedAt: true,
      },
      orderBy: [{ createdAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    });
  }
}
