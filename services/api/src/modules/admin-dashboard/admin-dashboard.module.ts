import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdentityModule } from "../identity.module";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { DashboardSnapshot } from "./dashboard-snapshot";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService, DashboardSnapshot],
})
export class AdminDashboardModule {}
