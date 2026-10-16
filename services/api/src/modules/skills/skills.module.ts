import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SkillsRepository } from "./infrastructure/skills.repository";
import { SkillsService } from "./application/skills.service";
import { SkillLevelsService } from "./application/skill-levels.service";
import { TagsService } from "./application/tags.service";
import { TagRequestsService } from "./application/tag-requests.service";
import { TagsRepository } from "./infrastructure/tags.repository";
import { AdminTagsController } from "./presentation/http/admin-tags.controller";
import {
  TagRequestsController,
  MyTagRequestsController,
  AdminTagRequestsController,
} from "./presentation/http/tag-requests.controller";
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
  providers: [
    SkillsRepository,
    SkillsService,
    SkillLevelsService,
    TagsRepository,
    TagsService,
    TagRequestsService,
  ],
  controllers: [
    AdminTagsController,
    TagRequestsController,
    MyTagRequestsController,
    AdminTagRequestsController,
    SkillsController,
    TagsController,
    CatalogController,
    SkillLevelsController,
    AdminSkillLevelsController,
  ],
  exports: [SkillsService],
})
export class SkillsModule {}
