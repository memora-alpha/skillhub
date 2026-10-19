import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { IdentityModule } from "../identity.module";
import { SkillsModule } from "../skills/skills.module";
import { AuditModule } from "../audit/audit.module";
import { SharingSkillsRepository } from "./infrastructure/sharing-skills.repository";
import { SharingSkillsService } from "./application/sharing-skills.service";
import {
  SharingSkillsController,
  SkillSearchController,
} from "./presentation/http/sharing-skills.controller";
@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    IdentityModule,
    SkillsModule,
    AuditModule,
  ],
  providers: [SharingSkillsRepository, SharingSkillsService],
  controllers: [SharingSkillsController, SkillSearchController],
  exports: [SharingSkillsService],
})
export class SharingSkillsModule {}
