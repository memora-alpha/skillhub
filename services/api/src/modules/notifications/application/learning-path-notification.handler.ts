import { Injectable, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { OutboxConsumer } from "../../../infrastructure/events/outbox-consumer";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../infrastructure/events/outbox.types";

const eventTypes = [
  "learning-path.locked",
  "learning-path.settled",
  "report.session.opened",
  "report.case.updated",
] as const;

@Injectable()
export class LearningPathNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly consumer: OutboxConsumer,
    private readonly db: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of eventTypes) this.registry.register(type, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    if (
      event.version < 1 ||
      !eventTypes.includes(event.type as (typeof eventTypes)[number])
    ) {
      throw new Error("INVALID_LEARNING_PATH_EVENT");
    }
    const payload = event.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("INVALID_LEARNING_PATH_EVENT");
    }
    const data = payload as Record<string, unknown>;
    let recipients: string[] = [];
    let title = "";
    let body = "";
    if (
      event.type === "learning-path.locked" ||
      event.type === "learning-path.settled"
    ) {
      if (typeof data.pathId !== "string")
        throw new Error("INVALID_LEARNING_PATH_EVENT");
      const path = await this.db.learningPath.findUnique({
        where: { id: data.pathId },
        select: { participantAId: true, participantBId: true },
      });
      if (!path) throw new Error("LEARNING_PATH_EVENT_TARGET_MISSING");
      recipients = [path.participantAId, path.participantBId];
      title =
        event.type === "learning-path.locked"
          ? "Learning path scheduled"
          : "Learning path completed";
      body =
        event.type === "learning-path.locked"
          ? "Your learning path schedule is now locked."
          : "Your learning path has completed and settlement is recorded.";
    } else if (event.type === "report.session.opened") {
      if (
        typeof data.sessionId !== "string" ||
        typeof data.reporterId !== "string"
      ) {
        throw new TypeError("INVALID_LEARNING_PATH_EVENT");
      }
      const session = await this.db.session.findUnique({
        where: { id: data.sessionId },
        select: { teacherId: true, learnerId: true },
      });
      if (!session) throw new Error("REPORT_EVENT_TARGET_MISSING");
      recipients = [session.teacherId, session.learnerId].filter(
        (id) => id !== data.reporterId,
      );
      title = "Session report opened";
      body = "A report was opened for a session you participated in.";
    } else {
      if (
        typeof data.reporterId !== "string" ||
        typeof data.status !== "string" ||
        typeof data.caseId !== "string"
      ) {
        throw new TypeError("INVALID_REPORT_CASE_EVENT");
      }
      recipients = [data.reporterId];
      title = "Report case updated";
      body = `Your report case status is ${data.status}.`;
    }
    await this.consumer.processOnce(
      "learning-path.notifications",
      event.eventId,
      async (tx) => {
        if (recipients.length === 0) return;
        const notificationPayload = {
          ...(typeof data.pathId === "string" ? { pathId: data.pathId } : {}),
          ...(typeof data.sessionId === "string"
            ? { sessionId: data.sessionId }
            : {}),
          ...(typeof data.caseId === "string" ? { caseId: data.caseId } : {}),
        };
        await tx.notification.createMany({
          data: recipients.map((userId, index) => ({
            id: index === 0 ? event.eventId : randomUUID(),
            userId,
            type: event.type,
            title,
            body,
            payload: notificationPayload,
            channel: "IN_APP" as const,
          })),
        });
      },
    );
  }
}
