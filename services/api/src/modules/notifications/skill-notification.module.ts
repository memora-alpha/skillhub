import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { SmtpTransactionalMailer } from "../../infrastructure/email/smtp-transactional-mailer.adapter";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { FcmPushSender } from "../../infrastructure/push/fcm-push-sender.adapter";
import { VerificationsModule } from "../verifications/verifications.module";
import { SkillNotificationHandler } from "./infrastructure/events/skill-notification.handler";
import { LearningPathNotificationHandler } from "./infrastructure/events/learning-path-notification.handler";
import { MaterialNotificationHandler } from "./infrastructure/events/material-notification.handler";
import { LearningRequestRejectionPublisher } from "./infrastructure/events/learning-request-rejection.publisher";
import {
  ENABLED_NOTIFICATION_CHANNELS,
  NotificationDispatcher,
  enabledChannels,
} from "./application/services/notification-dispatcher";
import {
  InAppNotificationPort,
  PushSender,
  TransactionalMailer,
} from "./application/ports/notification-channels";
import { PrismaInAppNotificationAdapter } from "./infrastructure/channels/prisma-in-app-notification.adapter";
@Module({
  imports: [OutboxModule, VerificationsModule, DatabaseModule],
  providers: [
    SkillNotificationHandler,
    LearningPathNotificationHandler,
    MaterialNotificationHandler,
    LearningRequestRejectionPublisher,
    NotificationDispatcher,
    {
      provide: InAppNotificationPort,
      useClass: PrismaInAppNotificationAdapter,
    },
    { provide: TransactionalMailer, useClass: SmtpTransactionalMailer },
    { provide: PushSender, useClass: FcmPushSender },
    {
      provide: ENABLED_NOTIFICATION_CHANNELS,
      useFactory: (config: ConfigService, push: PushSender) =>
        enabledChannels(config.get<string>("NOTIFICATION_CHANNELS"), push),
      inject: [ConfigService, PushSender],
    },
  ],
})
export class SkillNotificationModule {}
