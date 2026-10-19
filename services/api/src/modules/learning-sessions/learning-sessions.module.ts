import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReportsModule } from "../reports/reports.module";
import { LearningSessionsController } from "./learning-sessions.controller";
import { LearningSessionsService } from "./learning-sessions.service";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { LiveKitService } from "./livekit.service";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { LiveKitWebhookController } from "./livekit-webhook.controller";
import { SessionLifecycleWorker } from "./session-lifecycle.worker";
import { SessionCompletionHandler } from "./session-completion.handler";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    CreditModule,
    ReputationModule,
    ReportsModule,
    SystemConfigurationModule,
    OutboxModule,
  ],
  controllers: [LearningSessionsController, LiveKitWebhookController],
  providers: [
    LearningSessionsService,
    LiveKitService,
    SessionLifecycleWorker,
    SessionCompletionHandler,
  ],
  exports: [LearningSessionsService],
})
export class LearningSessionsModule {}
