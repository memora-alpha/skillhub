import { Module } from "@nestjs/common";
import { ContentModerationModule } from "../content-moderation/content-moderation.module";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SharingSkillsModule } from "../sharing-skills/sharing-skills.module";
import { VerificationsRepository } from "./infrastructure/persistence/verifications.repository";
import { VerificationsService } from "./application/services/verifications.service";
import { VerificationsController } from "./presentation/http/verifications.controller";
import { StaffVerificationsController } from "./presentation/http/staff-verifications.controller";
import { AdminVerificationReaderPort } from "./application/ports/admin-verification.reader";
import { AdminVerificationSourceReader } from "./application/services/admin-verification-source.reader";
@Module({
  imports: [
    ContentModerationModule,
    DatabaseModule,
    IdempotencyModule,
    OutboxModule,
    StorageModule,
    AuditModule,
    IdentityModule,
    SharingSkillsModule,
  ],
  providers: [
    VerificationsRepository,
    VerificationsService,
    AdminVerificationSourceReader,
    {
      provide: AdminVerificationReaderPort,
      useExisting: AdminVerificationSourceReader,
    },
  ],
  controllers: [VerificationsController, StaffVerificationsController],
  exports: [VerificationsService, AdminVerificationReaderPort],
})
export class VerificationsModule {}
