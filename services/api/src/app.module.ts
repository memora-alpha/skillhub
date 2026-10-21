import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SharedRequestGuard } from "./shared/auth/identity-throttle";
import { LoggerModule } from "nestjs-pino";
import { validateEnvironment } from "./configs/environment";
import {
  requestLogId,
  requestLogProperties,
  safeRequestLog,
} from "./configs/logging.config";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { RedisModule } from "./infrastructure/cache/redis.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { IdempotencyModule } from "./infrastructure/idempotency/idempotency.module";
import { OutboxModule } from "./infrastructure/events/outbox.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { SystemConfigurationModule } from "./modules/system-configuration/system-configuration.module";
import { HttpExceptionFilter } from "./shared/http/http-exception.filter";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity.module";
import { SkillsModule } from "./modules/skills/skills.module";
import { SharingSkillsModule } from "./modules/sharing-skills/sharing-skills.module";
import { VerificationsModule } from "./modules/verifications/verifications.module";
import { SkillNotificationModule } from "./modules/notifications/skill-notification.module";
import { LearningRequestsModule } from "./modules/learning-requests/learning-requests.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ApplicationEventsModule } from "./modules/application-events/application-events.module";
import { ProposalsModule } from "./modules/proposals/proposals.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { LearningPathsModule } from "./modules/learning-paths/learning-paths.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { LearningSessionsModule } from "./modules/learning-sessions/learning-sessions.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { CreditModule } from "./modules/credit/credit.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { MaterialsModule } from "./modules/materials/materials.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL"),
          genReqId: requestLogId,
          customProps: requestLogProperties,
          serializers: { req: safeRequestLog },
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
            "req.body",
            "res.body",
          ],
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    IdempotencyModule,
    OutboxModule,
    SystemConfigurationModule,
    StorageModule,
    IdentityModule,
    SkillsModule,
    SharingSkillsModule,
    VerificationsModule,
    SkillNotificationModule,
    LearningRequestsModule,
    NotificationsModule,
    ApplicationEventsModule,
    ProposalsModule,
    ConversationsModule,
    LearningPathsModule,
    SchedulingModule,
    LearningSessionsModule,
    ReviewsModule,
    ReportsModule,
    CreditModule,
    PaymentsModule,
    MaterialsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useExisting: SharedRequestGuard },
  ],
})
export class AppModule {}
