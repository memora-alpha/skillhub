import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { Proposal } from "../../../generated/prisma/client";
@Injectable()
export class ConversationLifecycleService {
  openFromAccepted(tx: TransactionContext, proposal: Proposal) {
    return tx.conversation.create({
      data: {
        proposalId: proposal.id,
        requestId: proposal.requestId,
        participantAId: proposal.proposerId,
        participantBId: proposal.recipientId,
      },
    });
  }
  readForProposal(tx: TransactionContext, proposalId: string) {
    return tx.conversation.findUnique({ where: { proposalId } });
  }
}
