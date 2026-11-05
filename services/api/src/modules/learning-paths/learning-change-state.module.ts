import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { LearningChangeState } from "./application/services/learning-change-state";

@Module({
  imports: [AuditModule, SystemConfigurationModule],
  providers: [LearningChangeState],
  exports: [LearningChangeState],
})
export class LearningChangeStateModule {}
