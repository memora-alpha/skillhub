import { Module } from "@nestjs/common";
import { ConversationMembershipReader } from "./conversation-membership.reader";

@Module({
  providers: [ConversationMembershipReader],
  exports: [ConversationMembershipReader],
})
export class ConversationsModule {}
