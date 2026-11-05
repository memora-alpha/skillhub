import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

@Injectable()
export class ConversationMembershipReader {
  /** Title-only projection for the viewer's conversations, including closed requests. */
  async readTitles(
    tx: TransactionContext,
    viewerId: string,
    conversationIds: string[],
  ) {
    if (!conversationIds.length) return new Map<string, string>();
    const rows = await tx.conversation.findMany({
      where: {
        id: { in: [...new Set(conversationIds)] },
        OR: [{ participantAId: viewerId }, { participantBId: viewerId }],
      },
      select: {
        id: true,
        requestIdRecord: { select: { title: true } },
        proposalIdRecord: {
          select: { skillIdRecord: { select: { name: true } } },
        },
      },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        row.requestIdRecord?.title ?? row.proposalIdRecord.skillIdRecord.name,
      ]),
    );
  }

  readParticipants(tx: TransactionContext, conversationId: string) {
    return tx.conversation.findUnique({
      where: { id: conversationId },
      select: { participantAId: true, participantBId: true },
    });
  }
}
