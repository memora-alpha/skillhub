import { Injectable, OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

type ActorField = "requestedByUserId" | "deletedByUserId";
type Audience = { other: ActorField } | "BOTH";

/** Spec 020 notices. `other` names the payload field of the participant who acted. */
const messages: Record<
  string,
  { audience: Audience; title: string; body: string }
> = {
  "session.recording.requested": {
    audience: { other: "requestedByUserId" },
    title: "Recording requested",
    body: "Your partner asked to record this session for later review. Accept or decline in the room.",
  },
  "session.recording.failed": {
    audience: "BOTH",
    title: "Recording failed",
    body: "The session recording could not be completed. The session itself is not affected.",
  },
  "session.recording.deleted": {
    audience: { other: "deletedByUserId" },
    title: "Recording deleted",
    body: "Your partner deleted the recording of your session. It is no longer available to either of you.",
  },
};

const payloadSchema = z.object({
  sessionId: z.uuid(),
  recordingId: z.uuid(),
  requestedByUserId: z.uuid().optional(),
  deletedByUserId: z.uuid().optional(),
});

@Injectable()
export class SessionRecordingNotificationHandler
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
    const parsed = payloadSchema.safeParse(event.payload);
    if (!message || event.version < 1 || !parsed.success)
      throw new Error("INVALID_SESSION_RECORDING_EVENT");
    const data = parsed.data;
    const session = await this.db.session.findUnique({
      where: { id: data.sessionId },
      select: { teacherId: true, learnerId: true },
    });
    if (!session) throw new Error("SESSION_RECORDING_EVENT_TARGET_MISSING");
    const both = [session.teacherId, session.learnerId];
    let userIds = both;
    if (message.audience !== "BOTH") {
      const actorId = data[message.audience.other];
      if (!actorId || !both.includes(actorId))
        throw new Error("INVALID_SESSION_RECORDING_EVENT");
      userIds = both.filter((id) => id !== actorId);
    }
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds,
      title: message.title,
      body: message.body,
      payload: { sessionId: data.sessionId, recordingId: data.recordingId },
    });
  }
}
