import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SkillsRepository } from "./infrastructure/skills.repository";
import { SkillsService } from "./application/skills.service";
import { SkillLevelsService } from "./application/skill-levels.service";
import {
  SkillLevelsController,
  AdminSkillLevelsController,
} from "./presentation/http/skill-levels.controller";
import {
  SkillsController,
  TagsController,
  CatalogController,
} from "./presentation/http/skills.controller";
@Module({
  imports: [DatabaseModule, IdempotencyModule, AuditModule, IdentityModule],
  providers: [SkillsRepository, SkillsService, SkillLevelsService],
  controllers: [
    SkillsController,
    TagsController,
    CatalogController,
    SkillLevelsController,
    AdminSkillLevelsController,
  ],
  exports: [SkillsService],
})
export class SkillsModule {}
