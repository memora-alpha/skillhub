import { Module } from "@nestjs/common";
import { ConversationTopicReader } from "./application/services/conversation-topic.reader";

// Read-only owner contract; avoids importing ProposalsModule back into ConversationsModule.
@Module({
  providers: [ConversationTopicReader],
  exports: [ConversationTopicReader],
})
export class ConversationTopicsModule {}
