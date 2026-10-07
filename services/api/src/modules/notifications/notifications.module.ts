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

@Module({
  imports: [DatabaseModule, IdentityModule, OutboxModule],
  controllers: [NotificationsController],
  providers: [
    IdentityGuard,
    NotificationAccessService,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    LearningRequestRejectionPublisher,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: PrismaNotificationRepository,
    },
  ],
})
export class NotificationsModule {}
