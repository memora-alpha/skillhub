import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SkillsRepository } from "./infrastructure/skills.repository";
import { SkillsService } from "./application/skills.service";
import {
  SkillsController,
  CatalogController,
} from "./presentation/http/skills.controller";
@Module({
  imports: [DatabaseModule, IdempotencyModule, AuditModule, IdentityModule],
  providers: [SkillsRepository, SkillsService],
  controllers: [SkillsController, CatalogController],
  exports: [SkillsService],
})
export class SkillsModule {}
