import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { ConversationTopicsModule } from "../proposals/conversation-topics.module";
import { ConnectionConfig } from "../proposals/domain/connection-config";
import { ConversationLifecycleService } from "./application/services/conversation-lifecycle.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { ChatRepository } from "./infrastructure/persistence/chat.repository";
import { ConversationAccessService } from "./application/services/conversation-access.service";
import { ChatPublicationService } from "./application/services/chat-publication.service";
import { ConversationsService } from "./application/services/conversations.service";
import { ConversationsController } from "./presentation/http/conversations.controller";
import { ConversationMembershipReader } from "./application/services/conversation-membership.reader";
@Module({
  imports: [
    DatabaseModule,
    ConversationTopicsModule,
    OutboxModule,
    StorageModule,
    IdentityModule,
    ApplicationEventsModule,
    NotificationsModule,
  ],
  providers: [
    ConnectionConfig,
    ConversationLifecycleService,
    ChatRepository,
    ConversationAccessService,
    ChatPublicationService,
    ConversationsService,
    ConversationMembershipReader,
  ],
  controllers: [ConversationsController],
  exports: [ConversationLifecycleService, ConversationMembershipReader],
})
export class ConversationsModule {}
