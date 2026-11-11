import type { Prisma } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export const evidenceMetadata = {
  id: true,
  storedFileId: true,
  mimeType: true,
  fileSizeBytes: true,
  uploadedAt: true,
} as const;

/** Null-party legacy evidence belongs only to the report's original reporter. */
export function partyEvidenceWhere(
  partyId: string,
  reporterId: string | null,
): Prisma.ReportEvidenceWhereInput {
  return {
    OR: [{ partyId }, ...(partyId === reporterId ? [{ partyId: null }] : [])],
  };
}

export async function ownEvidenceCounts(
  tx: TransactionContext,
  cases: { id: string; reporterId: string | null }[],
  viewerId: string,
) {
  if (!cases.length) return new Map<string, number>();
  const rows = await tx.reportEvidence.findMany({
    where: {
      caseId: { in: cases.map((c) => c.id) },
      OR: [
        { partyId: viewerId },
        {
          partyId: null,
          caseId: {
            in: cases.filter((c) => c.reporterId === viewerId).map((c) => c.id),
          },
        },
      ],
    },
    select: { caseId: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.caseId, (counts.get(row.caseId) ?? 0) + 1);
  return counts;
}
