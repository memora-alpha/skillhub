import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

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
    private readonly dispatcher: NotificationDispatcher,
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
    const resolveSessionNotification = async () => {
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
    };
    const resolveNotification = async () => {
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
        await resolveSessionNotification();
      } else {
        if (
          typeof data.reporterId !== "string" ||
          typeof data.status !== "string" ||
          typeof data.caseId !== "string"
        ) {
          throw new TypeError("INVALID_REPORT_CASE_EVENT");
        }
        recipients = await this.caseRecipients(
          data.reporterId,
          data.status,
          data.pathId,
        );
        title = "Report case updated";
        body = `The report case status is ${data.status}.`;
      }
    };
    await resolveNotification();
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: recipients,
      title,
      body,
      payload: {
        ...(typeof data.pathId === "string" ? { pathId: data.pathId } : {}),
        ...(typeof data.sessionId === "string"
          ? { sessionId: data.sessionId }
          : {}),
        ...(typeof data.caseId === "string" ? { caseId: data.caseId } : {}),
      },
    });
  }

  /** A final decision reaches both path participants; other updates only the reporter. */
  private async caseRecipients(
    reporterId: string,
    status: string,
    pathId: unknown,
  ): Promise<string[]> {
    if (
      typeof pathId !== "string" ||
      (status !== "RESOLVED" && status !== "REJECTED")
    ) {
      return [reporterId];
    }
    const path = await this.db.learningPath.findUnique({
      where: { id: pathId },
      select: { participantAId: true, participantBId: true },
    });
    return [
      ...new Set(
        path
          ? [reporterId, path.participantAId, path.participantBId]
          : [reporterId],
      ),
    ];
  }
}
