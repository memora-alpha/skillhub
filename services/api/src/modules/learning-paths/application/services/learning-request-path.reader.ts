import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { RequestLockReader } from "../../../learning-requests/application/ports/learning-request-dependencies";

export type RequestPathSource = {
  requestId: string | null;
  conversationId: string;
  proposalId: string;
  participantAId: string;
  participantBId: string;
};

@Injectable()
export class LearningRequestPathReader implements RequestLockReader {
  async readConversationSource(
    tx: TransactionContext,
    conversationId: string,
  ): Promise<RequestPathSource> {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException("CONVERSATION_NOT_FOUND");
    const proposal = await tx.proposal.findUnique({
      where: { id: conversation.proposalId },
    });
    const requestId = conversation.requestId;
    if (
      !proposal ||
      proposal.status !== "ACCEPTED" ||
      proposal.requestId !== requestId ||
      proposal.proposerId === proposal.recipientId ||
      conversation.participantAId !== proposal.proposerId ||
      conversation.participantBId !== proposal.recipientId ||
      proposal.sourceType !==
        (requestId === null ? "DIRECT_SEARCH" : "LEARNING_REQUEST")
    )
      throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    if (requestId !== null) {
      const request = await tx.learningRequest.findUnique({
        where: { id: requestId },
        select: { ownerId: true },
      });
      if (!request || request.ownerId !== proposal.recipientId)
        throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    }
    return {
      requestId,
      conversationId,
      proposalId: conversation.proposalId,
      participantAId: conversation.participantAId,
      participantBId: conversation.participantBId,
    };
  }

  async readPathSource(
    tx: TransactionContext,
    pathId: string,
  ): Promise<RequestPathSource> {
    const path = await tx.learningPath.findUnique({ where: { id: pathId } });
    if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
    const source = await this.readConversationSource(tx, path.conversationId);
    if (
      path.participantAId !== source.participantAId ||
      path.participantBId !== source.participantBId
    )
      throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    return source;
  }

  async readCommittedPathIds(
    tx: TransactionContext,
    requestId: string,
  ): Promise<string[]> {
    // Two rows suffice to distinguish no commitment, a unique winner and corruption.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT p.path_id AS id
      FROM learning_paths p
      JOIN conversations c ON c.conversation_id = p.conversation_id
      JOIN proposals q ON q.proposal_id = c.proposal_id
      WHERE (c.request_id = ${requestId}::uuid OR q.request_id = ${requestId}::uuid)
        AND (p.locked_version IS NOT NULL OR p.settled_at IS NOT NULL
          OR p.status::text IN ('SCHEDULED', 'ACTIVE', 'COMPLETED')
          OR EXISTS (SELECT 1 FROM schedule_proposals s WHERE s.path_id = p.path_id AND (s.status::text = 'LOCKED' OR s.applied_version IS NOT NULL))
          OR EXISTS (SELECT 1 FROM sessions s WHERE s.path_id = p.path_id)
          OR EXISTS (SELECT 1 FROM held_credit_allocations h WHERE h.path_id = p.path_id))
      ORDER BY p.path_id LIMIT 2
    `;
    return rows.map((row) => row.id);
  }

  async assertNotLocked(
    tx: TransactionContext,
    requestId: string,
  ): Promise<void> {
    if ((await this.readCommittedPathIds(tx, requestId)).length)
      throw new ConflictException("REQUEST_LOCKED");
    const conversations = await tx.conversation.findMany({
      where: { requestId },
      select: { id: true },
      take: 2,
    });
    if (conversations.length !== 1)
      throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
    await this.readConversationSource(tx, conversations[0]!.id);
  }
}
