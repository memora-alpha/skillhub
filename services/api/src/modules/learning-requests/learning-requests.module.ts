import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueueModule } from "../../infrastructure/queue/queue.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityGuard } from "../../shared/auth/identity.guard";
import { IdentityModule } from "../identity.module";
import { SkillActorService } from "../users/application/services/skill-actor.service";
import { SkillsModule } from "../skills/skills.module";
import { SkillsService } from "../skills/application/services/skills.service";
import { LearningRequestTagsService } from "../skills/application/services/learning-request-tags.service";
import { SharingSkillsModule } from "../sharing-skills/sharing-skills.module";
import { SharingSkillsService } from "../sharing-skills/application/services/sharing-skills.service";
import { LearningRequestAccessService } from "./application/services/learning-request-access.service";
import { LEARNING_REQUEST_REPOSITORY } from "./application/ports/learning-request-repository";
import { PrismaLearningRequestRepository } from "./infrastructure/persistence/prisma-learning-request.repository";
import {
  NEW_ACTIVITY_ELIGIBILITY_READER,
  REQUEST_OWNER_READER,
  REQUEST_LOCK_READER,
  SHARING_SKILL_READER,
  SKILL_CATALOG_READER,
  REQUEST_TAG_APPROVER,
} from "./application/ports/learning-request-dependencies";
import { UnavailableLearningRequestDependencies } from "./infrastructure/adapters/unavailable-learning-request-dependencies";
import { CreateLearningRequestUseCase } from "./application/use-cases/create-learning-request.use-case";
import { PublishLearningRequestUseCase } from "./application/use-cases/publish-learning-request.use-case";
import { LearningRequestsController } from "./presentation/http/learning-requests.controller";
import { SystemConfigurationModule } from "../system-configuration/system-configuration.module";
import { ModerateLearningRequestUseCase } from "./application/use-cases/moderate-learning-request.use-case";
import { RequestModerationController } from "./presentation/http/request-moderation.controller";
import { CancelLearningRequestUseCase } from "./application/use-cases/cancel-learning-request.use-case";
import { ExpireLearningRequestsUseCase } from "./application/use-cases/expire-learning-requests.use-case";
import { LearningRequestLifecycleService } from "./application/services/learning-request-lifecycle.service";
import { LearningRequestExpiryScheduler } from "./infrastructure/jobs/learning-request-expiry.scheduler";
import { LearningRequestExpiryWorker } from "./infrastructure/jobs/learning-request-expiry.worker";
import { EditLearningRequestUseCase } from "./application/use-cases/edit-learning-request.use-case";
import { ListLearningRequestsUseCase } from "./application/use-cases/list-learning-requests.use-case";
import { GetLearningRequestUseCase } from "./application/use-cases/get-learning-request.use-case";
import { ReputationModule } from "../reputation/reputation.module";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    SkillsModule,
    SharingSkillsModule,
    ReputationModule,
    SystemConfigurationModule,
    AuditModule,
    OutboxModule,
    QueueModule,
    BullModule.registerQueue({ name: "learning-request-expiry" }),
  ],
  controllers: [LearningRequestsController, RequestModerationController],
  providers: [
    IdentityGuard,
    LearningRequestExpiryScheduler,
    LearningRequestExpiryWorker,
    LearningRequestAccessService,
    UnavailableLearningRequestDependencies,
    {
      provide: REQUEST_TAG_APPROVER,
      useExisting: LearningRequestTagsService,
    },
    {
      provide: NEW_ACTIVITY_ELIGIBILITY_READER,
      useExisting: SkillActorService,
    },
    {
      provide: SKILL_CATALOG_READER,
      useExisting: SkillsService,
    },
    {
      provide: REQUEST_LOCK_READER,
      useExisting: UnavailableLearningRequestDependencies,
    },
    {
      provide: REQUEST_OWNER_READER,
      useExisting: SkillActorService,
    },
    {
      provide: SHARING_SKILL_READER,
      useExisting: SharingSkillsService,
    },
    CreateLearningRequestUseCase,
    PublishLearningRequestUseCase,
    ModerateLearningRequestUseCase,
    CancelLearningRequestUseCase,
    EditLearningRequestUseCase,
    ListLearningRequestsUseCase,
    GetLearningRequestUseCase,
    ExpireLearningRequestsUseCase,
    LearningRequestLifecycleService,
    {
      provide: LEARNING_REQUEST_REPOSITORY,
      useClass: PrismaLearningRequestRepository,
    },
  ],
  exports: [
    LearningRequestAccessService,
    LEARNING_REQUEST_REPOSITORY,
    CreateLearningRequestUseCase,
    PublishLearningRequestUseCase,
    ModerateLearningRequestUseCase,
    CancelLearningRequestUseCase,
    EditLearningRequestUseCase,
    ListLearningRequestsUseCase,
    GetLearningRequestUseCase,
    ExpireLearningRequestsUseCase,
    LearningRequestLifecycleService,
  ],
})
export class LearningRequestsModule {}
