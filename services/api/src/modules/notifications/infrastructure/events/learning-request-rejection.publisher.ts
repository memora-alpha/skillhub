import { Injectable, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import type { OutboxMessage } from "../../../../infrastructure/events/outbox.types";
import { OutboxPublisherRegistry } from "../../../../infrastructure/events/outbox.types";
import type { LearningRequestRejectionPayload } from "../../../learning-requests/application/contracts/learning-request-rejection.event";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

const eventType = "learning-request.rejected";
const payloadSchema = z.strictObject({
  requestId: z.uuid(),
  ownerId: z.uuid(),
  reviewedVersion: z.number().int().positive(),
  decisionVersion: z.number().int().positive(),
  rejectReason: z.string().trim().min(10).max(500),
});

function validateEvent(event: OutboxMessage): LearningRequestRejectionPayload {
  if (
    event.type !== eventType ||
    event.version !== 1 ||
    !z.uuid().safeParse(event.eventId).success ||
    !z.uuid().safeParse(event.correlationId).success
  ) {
    throw new TypeError("invalid learning request rejection event");
  }
  const payload = payloadSchema.parse(event.payload);
  if (payload.decisionVersion !== payload.reviewedVersion + 1) {
    throw new TypeError("invalid learning request rejection version");
  }
  return payload;
}

@Injectable()
export class LearningRequestRejectionPublisher implements OnModuleInit {
  constructor(
    private readonly publishers: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.publishers.register(eventType, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const payload = validateEvent(event);
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: [payload.ownerId],
      title: "Learning request not approved",
      body: payload.rejectReason,
      payload: {
        requestId: payload.requestId,
        reviewedVersion: String(payload.reviewedVersion),
        decisionVersion: String(payload.decisionVersion),
      },
    });
  }
}
