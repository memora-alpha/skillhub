import { IDENTITY_APPLICATION_PROVIDERS } from "./identity.providers";
import { AvatarWorker } from "./users/infrastructure/jobs/avatar.worker";
import { AvatarScheduler } from "./users/infrastructure/jobs/avatar.scheduler";
import { IdentityEmailWorker } from "./notifications/infrastructure/jobs/identity-email.worker";
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IdentityConfig } from "../configs/identity.config";
import { DatabaseModule } from "../infrastructure/database/database.module";
import { RedisModule } from "../infrastructure/cache/redis.module";
import { QueueModule } from "../infrastructure/queue/queue.module";
import { SmtpAdapter } from "../infrastructure/email/smtp.adapter";
import { AvatarStorage } from "../infrastructure/storage/avatar-storage";
import { AvatarScanner } from "../infrastructure/storage/avatar-scanner";
import { IdentityGuard } from "../shared/auth/identity.guard";
import {
  IdentityThrottle,
  SharedRequestGuard,
} from "../shared/auth/identity-throttle";

import { SessionsService } from "./auth/application/services/sessions.service";
import { AuthController } from "./auth/presentation/http/auth.controller";
import { UsersService } from "./users/application/services/users.service";

import { UsersController } from "./users/presentation/http/users.controller";
import { AdministrationController } from "./users/presentation/http/administration.controller";
import { AuditService } from "./audit/application/services/audit.service";
import { SkillActorService } from "./users/application/services/skill-actor.service";
import { PublicSkillReader } from "./users/application/services/public-skill-reader";
import { ProfileReader } from "./users/application/services/profile-reader.service";

// Composition root wires owner contracts without circular module imports.
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QueueModule,
    BullModule.registerQueue(
      { name: "identity-email" },
      { name: "identity-avatar" },
    ),
  ],
  controllers: [AuthController, UsersController, AdministrationController],
  providers: [
    IdentityConfig,
    SkillActorService,
    PublicSkillReader,
    SmtpAdapter,
    AvatarStorage,
    AvatarScanner,
    IdentityGuard,
    IdentityThrottle,
    SharedRequestGuard,
    ...IDENTITY_APPLICATION_PROVIDERS,
    AvatarWorker,
    AvatarScheduler,
    IdentityEmailWorker,
  ],
  exports: [
    ProfileReader,
    UsersService,
    IdentityGuard,
    SkillActorService,
    PublicSkillReader,
    SessionsService,
    AuditService,
    IdentityConfig,
    SharedRequestGuard,
  ],
})
export class IdentityModule {}
