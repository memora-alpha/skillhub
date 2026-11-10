import { Injectable, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

const eventType = "learning-path.schedule.confirmed";
const payloadSchema = z
  .object({
    pathId: z.uuid(),
    conversationId: z.uuid(),
    actorId: z.uuid(),
    recipientId: z.uuid(),
    scheduleId: z.uuid(),
    scheduleVersion: z.number().int().positive(),
    planId: z.uuid(),
    planVersion: z.number().int().positive(),
    teacherId: z.uuid(),
    learnerId: z.uuid(),
    messageId: z.uuid(),
    bothConfirmed: z.boolean(),
    isReschedule: z.boolean(),
    rescheduleApplied: z.boolean(),
    body: z.string().min(1).max(1000),
  })
  .strict();

@Injectable()
export class ScheduleConfirmationNotificationHandler implements OnModuleInit {
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
  ) {}
  onModuleInit(): void {
    this.registry.register(eventType, this);
  }
  async publish(event: OutboxMessage): Promise<void> {
    if (event.type !== eventType || event.version !== 1)
      throw new Error("INVALID_SCHEDULE_CONFIRMATION_EVENT");
    const data = payloadSchema.parse(event.payload);
    if (data.actorId === data.recipientId)
      throw new Error("INVALID_SCHEDULE_CONFIRMATION_RECIPIENT");
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: eventType,
      userIds: [data.recipientId],
      title: "Xác nhận lịch học",
      body: data.body,
      payload: {
        pathId: data.pathId,
        conversationId: data.conversationId,
        scheduleId: data.scheduleId,
        scheduleVersion: String(data.scheduleVersion),
        planId: data.planId,
        teacherId: data.teacherId,
        learnerId: data.learnerId,
        actorId: data.actorId,
        messageId: data.messageId,
      },
    });
  }
}
