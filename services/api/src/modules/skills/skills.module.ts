import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SkillsRepository } from "./infrastructure/persistence/skills.repository";
import { SkillsService } from "./application/services/skills.service";
import { SkillLevelsService } from "./application/services/skill-levels.service";
import { TagsService } from "./application/services/tags.service";
import { TagRequestsService } from "./application/services/tag-requests.service";
import { LearningRequestTagsService } from "./application/services/learning-request-tags.service";
import { TagsRepository } from "./infrastructure/persistence/tags.repository";
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
    LearningRequestTagsService,
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
  exports: [SkillsService, LearningRequestTagsService],
})
export class SkillsModule {}
