import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { CreditModule } from "../credit/credit.module";
import { LearningPathsModule } from "../learning-paths/learning-paths.module";
import { PaymentsModule } from "../payments/payments.module";
import { ReportsModule } from "../reports/reports.module";
import { SkillsModule } from "../skills/skills.module";
import { VerificationsModule } from "../verifications/verifications.module";
import { AdminDashboardReader } from "./application/services/admin-dashboard.reader";
import { AdminLearningPathsReader } from "./application/services/admin-learning-paths.reader";
import { AdminWorkItemsReader } from "./application/services/admin-work-items.reader";
import { AdminOperationsController } from "./presentation/http/admin-operations.controller";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    CreditModule,
    LearningPathsModule,
    PaymentsModule,
    ReportsModule,
    SkillsModule,
    VerificationsModule,
  ],
  controllers: [AdminOperationsController],
  providers: [
    AdminDashboardReader,
    AdminWorkItemsReader,
    AdminLearningPathsReader,
  ],
})
export class AdministrationModule {}
