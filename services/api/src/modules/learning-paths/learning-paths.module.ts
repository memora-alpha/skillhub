import { Module } from "@nestjs/common";
import { PathOverviewReader } from "./application/services/path-overview.reader";
import { PathOverviewController } from "./presentation/http/path-overview.controller";
import { SessionOverviewModule } from "../learning-sessions/session-overview.module";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { IdentityModule } from "../identity.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { CreditModule } from "../credit/credit.module";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { LearningPathsController } from "./presentation/http/learning-paths.controller";
import { LearningPathsService } from "./application/services/learning-paths.service";
import { LearningRequestsModule } from "../learning-requests/learning-requests.module";
import { LearningPathRequestStateModule } from "./learning-path-request-state.module";
import { LearningChangeStateModule } from "./learning-change-state.module";
import { SessionChangesModule } from "../learning-sessions/session-changes.module";
import { PathTerminationService } from "./application/services/path-termination.service";
import { PathTerminationController } from "./presentation/http/path-termination.controller";
import { ReportsModule } from "../reports/reports.module";
import { PathSettlementStatusService } from "./application/services/path-settlement-status.service";
import { PathSettlementStatusController } from "./presentation/http/path-settlement-status.controller";
import { LearningChangeReviewController } from "./presentation/http/learning-change-review.controller";
import { PathTerminationRecoveryWorker } from "./infrastructure/jobs/path-termination-recovery.worker";

@Module({
  imports: [
    SessionOverviewModule,
    DatabaseModule,
    LearningRequestsModule,
    LearningPathRequestStateModule,
    IdentityModule,
    ConversationsModule,
    CreditModule,
    SystemConfigurationModule,
    IdempotencyModule,
    LearningChangeStateModule,
    SessionChangesModule,
    ReportsModule,
  ],
  controllers: [
    PathOverviewController,
    LearningPathsController,
    PathTerminationController,
    PathSettlementStatusController,
    LearningChangeReviewController,
  ],
  providers: [
    PathOverviewReader,
    LearningPathsService,
    PathTerminationService,
    PathSettlementStatusService,
    PathTerminationRecoveryWorker,
  ],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
