import { Injectable, OnModuleInit } from "@nestjs/common";
import { OutboxConsumer } from "../../../infrastructure/events/outbox-consumer";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../infrastructure/events/outbox.types";
import { VerificationsService } from "../../verifications/application/verifications.service";
@Injectable()
export class SkillNotificationHandler implements OnModuleInit, OutboxPublisher {
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly consumer: OutboxConsumer,
    private readonly verifications: VerificationsService,
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
    await this.consumer.processOnce(
      "skill.notifications",
      event.eventId,
      async (tx) => {
        await tx.notification.create({
          data: {
            id: event.eventId,
            userId: summary.ownerId,
            type: event.type,
            title:
              event.type === "skill.evidence.revoked"
                ? "Skill evidence revoked"
                : "Skill verification reviewed",
            body: "Your skill verification decision is available in its history.",
            payload: {
              verificationId: summary.verificationId,
              sharingSkillId: summary.sharingSkillId,
            },
            channel: "IN_APP",
          },
        });
      },
    );
  }
}
