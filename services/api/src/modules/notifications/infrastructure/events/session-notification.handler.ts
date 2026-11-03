import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

type Audience = "BOTH" | "PRESENT" | "ABSENT";
const messages: Record<
  string,
  { audience: Audience; title: string; body: string }
> = {
  "session.attendance.determined": {
    audience: "BOTH",
    title: "Session attendance recorded",
    body: "Attendance for your session has been determined. Check the session for next steps.",
  },
  "session.absence-excuse.submitted": {
    audience: "PRESENT",
    title: "Absence explanation received",
    body: "Your partner explained their absence. Please accept or reject it.",
  },
  "session.absence-excuse.decided": {
    audience: "ABSENT",
    title: "Absence explanation decided",
    body: "Your partner responded to your absence explanation.",
  },
  "session.no-show.finalized": {
    audience: "BOTH",
    title: "Session no-show finalized",
    body: "The no-show result for your session is now final.",
  },
  "session.completed.timeout": {
    audience: "BOTH",
    title: "Session completed",
    body: "The confirmation window ended and the session was completed.",
  },
  "session.makeup.expired": {
    audience: "BOTH",
    title: "Makeup session overdue",
    body: "No makeup time was agreed in time; staff will review the session.",
  },
};

@Injectable()
export class SessionNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
    private readonly db: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of Object.keys(messages))
      this.registry.register(type, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const message = messages[event.type];
    const payload = event.payload as Record<string, unknown> | null;
    if (!message || event.version < 1 || typeof payload?.sessionId !== "string")
      throw new Error("INVALID_SESSION_EVENT");
    const session = await this.db.session.findUnique({
      where: { id: payload.sessionId },
      select: { teacherId: true, learnerId: true },
    });
    if (!session) throw new Error("SESSION_EVENT_TARGET_MISSING");
    const both = [session.teacherId, session.learnerId];
    const absentUserId = payload.absentUserId;
    if (message.audience !== "BOTH" && typeof absentUserId !== "string")
      throw new Error("INVALID_SESSION_EVENT");
    const audiences: Record<Audience, string[]> = {
      BOTH: both,
      PRESENT: both.filter((id) => id !== absentUserId),
      ABSENT: [absentUserId as string],
    };
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: audiences[message.audience],
      title: message.title,
      body: message.body,
      payload: { sessionId: payload.sessionId },
    });
  }
}
