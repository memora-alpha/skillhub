import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CLOCK, ServerClock } from "../../shared/time/clock";
import { AuditModule } from "../audit/audit.module";
import { SystemConfigurationService } from "./application/system-configuration.service";
import { UpdateConfigurationUseCase } from "./application/update-configuration.use-case";
import { ConfigurationRepository } from "./infrastructure/configuration.repository";

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [
    { provide: CLOCK, useClass: ServerClock },
    ConfigurationRepository,
    SystemConfigurationService,
    UpdateConfigurationUseCase,
  ],
  // Update stays private until a real users/authorization contract is present.
  exports: [CLOCK, SystemConfigurationService],
})
export class SystemConfigurationModule {}
