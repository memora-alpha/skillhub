import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CLOCK, ServerClock } from "../../shared/time/clock";
import { AuditModule } from "../audit/audit.module";
import { SystemConfigurationService } from "./application/system-configuration.service";
import { UpdateConfigurationUseCase } from "./application/update-configuration.use-case";
import { ConfigurationRepository } from "./infrastructure/configuration.repository";
import { IdentityModule } from "../identity.module";
import { IdentityGuard } from "../../shared/auth/identity.guard";
import { LearningRequestModerationRulesUseCase } from "./application/learning-request-moderation-rules.use-case";
import { LearningRequestModerationRulesController } from "./presentation/http/learning-request-moderation-rules.controller";

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [LearningRequestModerationRulesController],
  providers: [
    { provide: CLOCK, useClass: ServerClock },
    ConfigurationRepository,
    SystemConfigurationService,
    UpdateConfigurationUseCase,
    LearningRequestModerationRulesUseCase,
    IdentityGuard,
  ],
  // Update stays private until a real users/authorization contract is present.
  exports: [CLOCK, SystemConfigurationService],
})
export class SystemConfigurationModule {}
