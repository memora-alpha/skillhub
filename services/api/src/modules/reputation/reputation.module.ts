import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { ReputationService } from "./application/services/reputation.service";
import { AchievementsService } from "./application/services/achievements.service";
import { AchievementsController } from "./presentation/http/achievements.controller";
import { RestrictionReviewsController } from "./presentation/http/restriction-reviews.controller";
import { RecoveryController } from "./presentation/http/recovery.controller";
import { RecoveryService } from "./application/services/recovery.service";

@Module({
  imports: [DatabaseModule, IdentityModule, AuditModule],
  controllers: [
    AchievementsController,
    RestrictionReviewsController,
    RecoveryController,
  ],
  providers: [ReputationService, AchievementsService, RecoveryService],
  exports: [ReputationService, AchievementsService],
})
export class ReputationModule {}
