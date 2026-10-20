import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { ReputationService } from "./application/services/reputation.service";
import { AchievementsService } from "./application/services/achievements.service";
import { AchievementsController } from "./presentation/http/achievements.controller";

@Module({
  imports: [DatabaseModule, IdentityModule, AuditModule],
  controllers: [AchievementsController],
  providers: [ReputationService, AchievementsService],
  exports: [ReputationService, AchievementsService],
})
export class ReputationModule {}
