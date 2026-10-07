import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity.module";
import { SharingSkillsModule } from "../sharing-skills/sharing-skills.module";
import { VerificationsRepository } from "./infrastructure/verifications.repository";
import { VerificationsService } from "./application/verifications.service";
import { VerificationsController } from "./presentation/http/verifications.controller";
import { StaffVerificationsController } from "./presentation/http/staff-verifications.controller";
@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    OutboxModule,
    StorageModule,
    AuditModule,
    IdentityModule,
    SharingSkillsModule,
  ],
  providers: [VerificationsRepository, VerificationsService],
  controllers: [VerificationsController, StaffVerificationsController],
  exports: [VerificationsService],
})
export class VerificationsModule {}
