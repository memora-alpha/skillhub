import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { AdminDashboardReader } from "./application/services/admin-dashboard.reader";
import { AdminLearningPathsReader } from "./application/services/admin-learning-paths.reader";
import { AdminWorkItemsReader } from "./application/services/admin-work-items.reader";
import { AdminOperationsController } from "./presentation/http/admin-operations.controller";

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [AdminOperationsController],
  providers: [
    AdminDashboardReader,
    AdminWorkItemsReader,
    AdminLearningPathsReader,
  ],
})
export class AdministrationModule {}
