import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { VerificationsModule } from "../verifications/verifications.module";
import { SkillNotificationHandler } from "./application/skill-notification.handler";
import { LearningPathNotificationHandler } from "./application/learning-path-notification.handler";
@Module({
  imports: [OutboxModule, VerificationsModule, DatabaseModule],
  providers: [SkillNotificationHandler, LearningPathNotificationHandler],
})
export class SkillNotificationModule {}
