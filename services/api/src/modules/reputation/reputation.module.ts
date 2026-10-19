import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { ReputationService } from "./reputation.service";
import { AchievementsService } from "./achievements.service";
import { AchievementsController } from "./achievements.controller";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AchievementsController],
  providers: [ReputationService, AchievementsService],
  exports: [ReputationService, AchievementsService],
})
export class ReputationModule {}
