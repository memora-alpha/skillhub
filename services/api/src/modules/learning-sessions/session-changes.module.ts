import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { LearningChangeStateModule } from "../learning-paths/learning-change-state.module";
import { SessionChangesService } from "./application/services/session-changes.service";
import { SessionChangesController } from "./presentation/http/session-changes.controller";
import { LearningChangeRecoveryWorker } from "./infrastructure/jobs/learning-change-recovery.worker";

@Module({
  imports: [DatabaseModule, IdentityModule, LearningChangeStateModule],
  providers: [SessionChangesService, LearningChangeRecoveryWorker],
  controllers: [SessionChangesController],
  exports: [SessionChangesService],
})
export class SessionChangesModule {}
