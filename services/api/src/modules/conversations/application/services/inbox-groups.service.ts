import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { ProposalInboxReader } from "../../../proposals/application/services/proposal-inbox.reader";
import { ConversationTopicReader } from "../../../proposals/application/services/conversation-topic.reader";
import { LearningRequestInboxReader } from "../../../learning-requests/application/services/learning-request-inbox.reader";
import { cursorScope } from "../../../skills/domain/skill-policy";
import { InboxGroupsRepository } from "../../infrastructure/persistence/inbox-groups.repository";
import { InboxMessageReader } from "./inbox-message.reader";
import {
  readInboxGroupCursor,
  writeInboxGroupCursor,
} from "../../domain/inbox-group-cursor";

@Injectable()
export class InboxGroupsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly repository: InboxGroupsRepository,
    private readonly proposals: ProposalInboxReader,
    private readonly requests: LearningRequestInboxReader,
    private readonly topics: ConversationTopicReader,
    private readonly messages: InboxMessageReader,
  ) {}

  async list(principal: Principal, query: { limit?: number; cursor?: string }) {
    const limit = query.limit ?? 20;
    const scope = cursorScope({
      type: "inbox-groups",
      viewer: principal.userId,
      order: "activity-key-desc-v1",
    });
    const cursor = readInboxGroupCursor(query.cursor, scope);
    const result = await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "conversation:read:participant");
      await this.actors.require(tx, principal, "proposal:read:party");
      const rows = await this.repository.page(
        tx,
        principal.userId,
        this.proposals.groupedProjection(principal.userId),
        limit,
        cursor,
      );
      const selected = rows.slice(0, limit);
      const requests = await this.requests.read(
        tx,
        principal.userId,
        selected.flatMap((row) =>
          row.learningRequestId ? [row.learningRequestId] : [],
        ),
      );
      const topics = await this.topics.read(
        tx,
        selected.flatMap((row) =>
          row.sourceProposalId ? [row.sourceProposalId] : [],
        ),
      );
      const data = selected.map((row) => {
        const request = row.learningRequestId
          ? requests.get(row.learningRequestId)
          : undefined;
        if (row.learningRequestId && !request)
          throw new ServiceUnavailableException("INBOX_SOURCE_UNAVAILABLE");
        const owner = request?.ownerId === principal.userId;
        let viewerRole: "OWNER" | "PROPOSER" | "PARTICIPANT" = "PARTICIPANT";
        if (owner) viewerRole = "OWNER";
        else if (request && row.sentProposalCount > 0) viewerRole = "PROPOSER";
        return {
          id: row.key,
          groupType: row.groupType,
          learningRequestId: row.learningRequestId,
          conversationId: row.conversationId,
          title:
            request?.title ??
            (row.sourceProposalId
              ? (topics.get(row.sourceProposalId) ?? null)
              : null),
          viewerRole,
          receivedProposalCount: owner ? row.receivedProposalCount : null,
          sentProposalCount: request ? row.sentProposalCount : null,
          conversationCount: row.conversationCount,
          lastActivityAt: row.lastActivityAt,
        };
      });
      const hasMore = rows.length > limit;
      const last = selected.at(-1);
      return {
        data,
        pagination: {
          limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? writeInboxGroupCursor(scope, last.key, last.lastActivityAt)
              : null,
        },
      };
    });
    const summaries = await this.messages.read(principal, result.data);
    return {
      ...result,
      data: result.data.map((group) => ({
        ...group,
        ...summaries.get(group.id)!,
      })),
    };
  }
}
