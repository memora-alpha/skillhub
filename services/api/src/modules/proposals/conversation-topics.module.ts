import { ProposalInboxReader } from "./application/services/proposal-inbox.reader";
import { Module } from "@nestjs/common";
import { ConversationTopicReader } from "./application/services/conversation-topic.reader";

// Read-only owner contract; avoids importing ProposalsModule back into ConversationsModule.
@Module({
  providers: [ConversationTopicReader, ProposalInboxReader],
  exports: [ConversationTopicReader, ProposalInboxReader],
})
export class ConversationTopicsModule {}
