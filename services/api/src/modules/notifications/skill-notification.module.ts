import { Module } from "@nestjs/common";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { VerificationsModule } from "../verifications/verifications.module";
import { SkillNotificationHandler } from "./application/skill-notification.handler";
@Module({
  imports: [OutboxModule, VerificationsModule],
  providers: [SkillNotificationHandler],
})
export class SkillNotificationModule {}
