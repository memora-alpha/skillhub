import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { ConnectionConfig } from "../proposals/domain/connection-config";
import { ConversationLifecycleService } from "./application/conversation-lifecycle.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { ChatRepository } from "./infrastructure/chat.repository";
import { ConversationAccessService } from "./application/conversation-access.service";
import { ChatPublicationService } from "./application/chat-publication.service";
import { ConversationsService } from "./application/conversations.service";
import { ConversationsController } from "./presentation/conversations.controller";
@Module({
  imports: [
    DatabaseModule,
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
  ],
  controllers: [ConversationsController],
  exports: [ConversationLifecycleService],
})
export class ConversationsModule {}
