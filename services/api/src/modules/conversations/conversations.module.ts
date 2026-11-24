import { InboxGroupsService } from "./application/services/inbox-groups.service";
import { InboxGroupsRepository } from "./infrastructure/persistence/inbox-groups.repository";
import { ChatInboxRepository } from "./infrastructure/persistence/chat-inbox.repository";
import { InboxMessageReader } from "./application/services/inbox-message.reader";
import { LearningRequestInboxModule } from "../learning-requests/learning-request-inbox.module";
import { ConversationTopicsModule } from "../proposals/conversation-topics.module";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { ConnectionConfig } from "../proposals/domain/connection-config";
import { ConversationLifecycleService } from "./application/services/conversation-lifecycle.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { ChatRepository } from "./infrastructure/persistence/chat.repository";
import { ConversationAccessService } from "./application/services/conversation-access.service";
import { ChatPublicationService } from "./application/services/chat-publication.service";
import { SystemMessagePublisher } from "./application/services/system-message-publisher";
import { ConversationsService } from "./application/services/conversations.service";
import { ConversationsController } from "./presentation/http/conversations.controller";
import { ConversationMembershipReader } from "./application/services/conversation-membership.reader";
import { ContentModerationModule } from "../content-moderation/content-moderation.module";
import { ChatDownloadTicketService } from "./application/services/chat-download-ticket.service";
import { ChatAttachmentContentController } from "./presentation/http/chat-attachment-content.controller";
import { ChatAttachmentModerationController } from "./presentation/http/chat-attachment-moderation.controller";
@Module({
  imports: [
    LearningRequestInboxModule,
    ConversationTopicsModule,
    DatabaseModule,
    OutboxModule,
    StorageModule,
    ContentModerationModule,
    IdentityModule,
    ApplicationEventsModule,
    NotificationsModule,
  ],
  providers: [
    InboxGroupsService,
    InboxGroupsRepository,
    ChatInboxRepository,
    InboxMessageReader,
    ConnectionConfig,
    ConversationLifecycleService,
    ChatRepository,
    ConversationAccessService,
    ChatPublicationService,
    SystemMessagePublisher,
    ConversationsService,
    ChatDownloadTicketService,
    ConversationMembershipReader,
  ],
  controllers: [
    ConversationsController,
    ChatAttachmentContentController,
    ChatAttachmentModerationController,
  ],
  exports: [ConversationLifecycleService, ConversationMembershipReader],
})
export class ConversationsModule {}
