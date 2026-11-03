import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

/** Historical title-only access for owners, proposers and chat participants.
 * This does not grant access to a closed/hidden Request's public detail/body.
 */
@Injectable()
export class LearningRequestInboxReader {
  read(tx: TransactionContext, viewerId: string, requestIds: string[]) {
    return readLearningRequestInboxMetadata(tx, viewerId, requestIds);
  }
}

export async function readLearningRequestInboxMetadata(
  tx: TransactionContext,
  viewerId: string,
  requestIds: string[],
) {
  if (!requestIds.length)
    return new Map<string, { title: string; ownerId: string }>();
  const rows = await tx.learningRequest.findMany({
    where: {
      id: { in: [...new Set(requestIds)] },
      OR: [
        { ownerId: viewerId },
        { proposalRequestIdRecords: { some: { proposerId: viewerId } } },
        {
          conversationRequestIdRecords: {
            some: {
              OR: [{ participantAId: viewerId }, { participantBId: viewerId }],
            },
          },
        },
      ],
    },
    select: { id: true, ownerId: true, title: true },
  });
  return new Map(
    rows.map((row) => [row.id, { title: row.title, ownerId: row.ownerId }]),
  );
}
