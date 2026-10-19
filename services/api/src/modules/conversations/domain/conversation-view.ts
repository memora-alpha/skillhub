import type { Conversation } from "../../../generated/prisma/client";
export function conversationView(row: Conversation) {
  return {
    id: row.id,
    proposalId: row.proposalId,
    learningRequestId: row.requestId,
    participantAId: row.participantAId,
    participantBId: row.participantBId,
    createdAt: row.createdAt,
  };
}
