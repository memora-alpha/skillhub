import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

@Injectable()
export class ConversationMembershipReader {
  readParticipants(tx: TransactionContext, conversationId: string) {
    return tx.conversation.findUnique({
      where: { id: conversationId },
      select: { participantAId: true, participantBId: true },
    });
  }
}
