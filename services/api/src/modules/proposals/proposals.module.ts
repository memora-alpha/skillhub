import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { IdempotencyModule } from "../../infrastructure/idempotency/idempotency.module";
import { IdentityModule } from "../identity.module";
import { SharingSkillsModule } from "../sharing-skills/sharing-skills.module";
import { LearningRequestsModule } from "../learning-requests/learning-requests.module";
import { ApplicationEventsModule } from "../application-events/application-events.module";
import { ProposalsService } from "./application/proposals.service";
import { ProposalExpiryService } from "./application/proposal-expiry.service";
import { ConnectionConfig } from "./domain/connection-config";
import { ProposalsController } from "./presentation/proposals.controller";
import { AuditModule } from "../audit/audit.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { NotificationsModule } from "../notifications/notifications.module";
@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    IdentityModule,
    SharingSkillsModule,
    LearningRequestsModule,
    ApplicationEventsModule,
    AuditModule,
    ConversationsModule,
    NotificationsModule,
  ],
  providers: [ProposalsService, ProposalExpiryService, ConnectionConfig],
  controllers: [ProposalsController],
  exports: [ConnectionConfig],
})
export class ProposalsModule {}
