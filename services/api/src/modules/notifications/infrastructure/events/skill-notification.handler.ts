import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { VerificationsService } from "../../../verifications/application/services/verifications.service";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";
@Injectable()
export class SkillNotificationHandler implements OnModuleInit, OutboxPublisher {
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly verifications: VerificationsService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}
  onModuleInit(): void {
    this.registry.register("skill.verification.decided", this);
    this.registry.register("skill.evidence.revoked", this);
  }
  async publish(event: OutboxMessage): Promise<void> {
    const payload = event.payload;
    if (
      event.version !== 1 ||
      !["skill.verification.decided", "skill.evidence.revoked"].includes(
        event.type,
      ) ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      typeof payload.verificationId !== "string"
    )
      throw new Error("INVALID_VERIFICATION_EVENT");
    const summary = await this.verifications.notificationSummary(
      payload.verificationId,
    );
    if (
      payload.ownerId !== summary.ownerId ||
      payload.sharingSkillId !== summary.sharingSkillId
    )
      throw new Error("INVALID_VERIFICATION_EVENT");
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: [summary.ownerId],
      title:
        event.type === "skill.evidence.revoked"
          ? "Skill evidence revoked"
          : "Skill verification reviewed",
      body: "Your skill verification decision is available in its history.",
      payload: {
        verificationId: summary.verificationId,
        sharingSkillId: summary.sharingSkillId,
      },
    });
  }
}
