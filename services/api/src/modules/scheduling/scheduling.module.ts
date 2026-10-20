import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { SchedulingController } from "./presentation/http/scheduling.controller";
import { SchedulingService } from "./application/services/scheduling.service";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    AuditModule,
    SystemConfigurationModule,
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
