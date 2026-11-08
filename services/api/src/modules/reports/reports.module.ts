import { ParticipantCasesReader } from "./application/services/participant-cases.reader";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { Module } from "@nestjs/common";
import { ReportSupportService } from "./application/services/report-support.service";
import { CaseMessagesService } from "./application/services/case-messages.service";
import { CaseMessageRepository } from "./infrastructure/persistence/case-message.repository";
import { ReportSupportController } from "./presentation/http/report-support.controller";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { CreditModule } from "../credit/credit.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { ReportsController } from "./presentation/http/reports.controller";
import { ReportsService } from "./application/services/reports.service";
import { SessionChangesModule } from "../learning-sessions/session-changes.module";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    IdentityModule,
    AuditModule,
    ReputationModule,
    CreditModule,
    SystemConfigurationModule,
    SessionChangesModule,
  ],
  controllers: [ReportsController, ReportSupportController],
  providers: [
    ParticipantCasesReader,
    ReportsService,
    ReportSupportService,
    CaseMessagesService,
    CaseMessageRepository,
  ],
  exports: [ReportsService, ParticipantCasesReader],
})
export class ReportsModule {}
