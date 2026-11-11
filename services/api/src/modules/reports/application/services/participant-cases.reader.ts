import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { ownEvidenceCounts } from "./report-evidence-view";
import { casePartyCapabilities } from "../../domain/case-capabilities";
import { effectiveRestriction } from "../../../reputation/domain/restriction-policy";
@Injectable()
export class ParticipantCasesReader {
  async batch(
    tx: TransactionContext,
    viewerId: string,
    pathIds: string[],
    now = new Date(),
  ) {
    const cases = await tx.reportCase.findMany({
      where: {
        relatedPathId: { in: pathIds },
        relatedPathIdRecord: {
          OR: [{ participantAId: viewerId }, { participantBId: viewerId }],
        },
      },
      select: {
        id: true,
        handlerId: true,
        reporterId: true,
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
    if (!cases.length) return [];
    const [counts, restriction] = await Promise.all([
      ownEvidenceCounts(tx, cases, viewerId),
      tx.userRestriction.findFirst({
        where: { userId: viewerId, scope: "ALL", ...effectiveRestriction(now) },
        select: { id: true },
      }),
    ]);
    return cases.map((item) => ({
      id: item.id,
      relatedPathId: item.relatedPathId,
      relatedSessionId: item.relatedSessionId,
      reasonCode: item.reasonCode,
      status: item.status,
      blocksSettlement: item.blocksSettlement,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      ...casePartyCapabilities({
        status: item.status,
        handlerId: item.handlerId,
        ownEvidenceCount: counts.get(item.id) ?? 0,
        restricted: Boolean(restriction),
      }),
    }));
  }
}
