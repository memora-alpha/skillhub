import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { InboxGroupsRepository } from "../../infrastructure/persistence/inbox-groups.repository";
import { ChatInboxRepository } from "../../infrastructure/persistence/chat-inbox.repository";
import {
  newerInboxMessage,
  type InboxMessageSummary,
} from "../../domain/inbox-message-summary";

type Group = {
  id: string;
  learningRequestId: string | null;
  conversationId: string | null;
};
const batchSize = 100;

@Injectable()
export class InboxMessageReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly repository: InboxGroupsRepository,
    private readonly chat: ChatInboxRepository,
  ) {}

  async read(principal: Principal, groups: Group[]) {
    const result = new Map<string, InboxMessageSummary>(
      groups.map((group) => [
        group.id,
        { latestMessage: null, hasUnread: false },
      ]),
    );
    if (!groups.length) return result;
    const requestIds = groups.flatMap((group) =>
      group.learningRequestId ? [group.learningRequestId] : [],
    );
    const directIds = groups.flatMap((group) =>
      group.conversationId ? [group.conversationId] : [],
    );
    let after: string | undefined;
    for (;;) {
      // Each next page depends on the final authorized ID from the previous batch.
      // Release PostgreSQL locks before any Mongo I/O; retain only one batch.
      const conversations = await this.transactions.run(async (tx) => {
        await this.actors.require(
          tx,
          principal,
          "conversation:read:participant",
        );
        return this.repository.conversations(
          tx,
          principal.userId,
          requestIds,
          directIds,
          batchSize,
          after,
        );
      });
      if (!conversations.length) break;
      const states = new Map(
        (
          await this.chat.read(
            conversations.map((row) => row.id),
            principal.userId,
          )
        ).map((state) => [state.conversationId, state]),
      );
      for (const conversation of conversations) {
        const state = states.get(conversation.id);
        const key = conversation.requestId
          ? `request:${conversation.requestId}`
          : `conversation:${conversation.id}`;
        const summary = result.get(key);
        if (!state || !summary)
          throw new ServiceUnavailableException("INBOX_MESSAGES_UNAVAILABLE");
        summary.latestMessage = newerInboxMessage(
          summary.latestMessage,
          state.latestMessage,
        );
        summary.hasUnread ||= state.hasUnread;
      }
      after = conversations.at(-1)!.id;
      if (conversations.length < batchSize) break;
    }
    // Session/grant revocation during Mongo hydration must not return message text.
    await this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal, "conversation:read:participant");
      await this.actors.require(tx, principal, "proposal:read:party");
    });
    return result;
  }
}
