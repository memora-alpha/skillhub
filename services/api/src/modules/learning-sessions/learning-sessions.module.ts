import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReportsModule } from "../reports/reports.module";
import { LearningSessionsController } from "./learning-sessions.controller";
import { LearningSessionsService } from "./learning-sessions.service";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    CreditModule,
    ReputationModule,
    ReportsModule,
  ],
  controllers: [LearningSessionsController],
  providers: [LearningSessionsService],
  exports: [LearningSessionsService],
})
export class LearningSessionsModule {}
