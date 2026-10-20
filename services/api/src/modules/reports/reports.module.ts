import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReportsController } from "./presentation/http/reports.controller";
import { ReportsService } from "./application/services/reports.service";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    IdentityModule,
    AuditModule,
    ReputationModule,
    CreditModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
