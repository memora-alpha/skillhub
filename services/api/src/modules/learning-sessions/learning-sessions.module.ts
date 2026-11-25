import { ContentModerationModule } from "../content-moderation/content-moderation.module";
import { SessionOutcomeService } from "./application/services/session-outcome.service";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReportsModule } from "../reports/reports.module";
import { LearningSessionsController } from "./presentation/http/learning-sessions.controller";
import { LearningSessionsService } from "./application/services/learning-sessions.service";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { LiveKitService } from "./infrastructure/livekit/livekit.service";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { LiveKitWebhookController } from "./presentation/http/livekit-webhook.controller";
import { SessionLifecycleWorker } from "./infrastructure/jobs/session-lifecycle.worker";
import { SessionCompletionHandler } from "./infrastructure/events/session-completion.handler";
import { LearningRequestsModule } from "../learning-requests/learning-requests.module";
import { LearningPathRequestStateModule } from "../learning-paths/learning-path-request-state.module";
import { AuditModule } from "../audit/audit.module";
import { SessionWhiteboardController } from "./presentation/http/session-whiteboard.controller";
import { SessionWhiteboardService } from "./application/services/session-whiteboard.service";
import { SessionWhiteboardRetentionWorker } from "./infrastructure/jobs/session-whiteboard-retention.worker";

@Module({
  imports: [
    ContentModerationModule,
    AuditModule,
    DatabaseModule,
    LearningRequestsModule,
    LearningPathRequestStateModule,
    IdentityModule,
    CreditModule,
    ReputationModule,
    ReportsModule,
    SystemConfigurationModule,
    OutboxModule,
  ],
  controllers: [
    LearningSessionsController,
    LiveKitWebhookController,
    SessionWhiteboardController,
  ],
  providers: [
    LearningSessionsService,
    SessionOutcomeService,
    LiveKitService,
    SessionLifecycleWorker,
    SessionCompletionHandler,
    SessionWhiteboardService,
    SessionWhiteboardRetentionWorker,
  ],
  exports: [LearningSessionsService],
})
export class LearningSessionsModule {}
