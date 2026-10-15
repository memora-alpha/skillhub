import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { IdentityGuard } from "../../shared/auth/identity.guard";
import { IdentityModule } from "../identity.module";
import { NOTIFICATION_REPOSITORY } from "./application/ports/notification-repository";
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
} from "./application/use-cases/notification-inbox.use-cases";
import { NotificationAccessService } from "./application/services/notification-access.service";
import { LearningRequestRejectionPublisher } from "./infrastructure/events/learning-request-rejection.publisher";
import { PrismaNotificationRepository } from "./infrastructure/persistence/prisma-notification.repository";
import { NotificationsController } from "./presentation/http/notifications.controller";
import { PushTokensController } from "./presentation/http/push-tokens.controller";
import { PushTokensUseCases } from "./application/use-cases/push-tokens.use-cases";
import { ConnectionNotificationService } from "./application/services/connection-notification.service";

@Module({
  imports: [DatabaseModule, IdentityModule, OutboxModule],
  controllers: [NotificationsController, PushTokensController],
  providers: [
    ConnectionNotificationService,
    IdentityGuard,
    NotificationAccessService,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    PushTokensUseCases,
    LearningRequestRejectionPublisher,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
  ],
  exports: [ConnectionNotificationService],
})
export class NotificationsModule {}
