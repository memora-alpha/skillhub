import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export const INACTIVE_SESSION_STATUSES: readonly string[] = [
  "CANCELLED",
  "COMPLETED",
  "DISPUTED",
  "NO_SHOW",
  "MAKEUP_REQUIRED",
];

const earlier = (a: Date, b: Date) => (+a <= +b ? a : b);
const later = (a: Date, b: Date) => (+a >= +b ? a : b);

/** Idempotent: every write is a min/max, so duplicates and reordering converge. */
export async function recordParticipantEvent(
  tx: TransactionContext,
  input: {
    sessionId: string;
    userId: string;
    role: "TEACHER" | "LEARNER";
    roomSid: string;
    participantSid: string;
    joined: boolean;
    occurredAt: Date;
    observed?: boolean;
  },
) {
  const where = {
    sessionId_participantSid: {
      sessionId: input.sessionId,
      participantSid: input.participantSid,
    },
  };
  const existing = await tx.sessionAttendanceInterval.findUnique({ where });
  if (!existing) {
    await tx.sessionAttendanceInterval.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        role: input.role,
        roomSid: input.roomSid,
        participantSid: input.participantSid,
        joinedAt: input.occurredAt,
        lastSeenAt: input.occurredAt,
        // A left that overtook its joined starts as a zero-length interval.
        ...(input.joined
          ? {}
          : { leftAt: input.occurredAt, closeSource: "WEBHOOK" as const }),
      },
    });
    return;
  }
  if (input.joined) {
    await tx.sessionAttendanceInterval.update({
      where,
      data: {
        joinedAt: earlier(existing.joinedAt, input.occurredAt),
        lastSeenAt: later(existing.lastSeenAt, input.occurredAt),
        // An authoritative active snapshot can recover a provisional heartbeat close.
        ...(input.observed &&
        existing.closeSource === "HEARTBEAT" &&
        input.occurredAt > existing.lastSeenAt
          ? { leftAt: null, closeSource: null }
          : {}),
      },
    });
    return;
  }
  const leftAt = later(existing.joinedAt, input.occurredAt);
  if (existing.leftAt && +existing.leftAt >= +leftAt) return;
  await tx.sessionAttendanceInterval.update({
    where,
    data: {
      leftAt,
      lastSeenAt: later(existing.lastSeenAt, leftAt),
      closeSource: "WEBHOOK",
    },
  });
}

export async function closeOpenIntervals(
  tx: TransactionContext,
  sessionId: string,
  at: Date,
  source: "HEARTBEAT" | "ROOM_FINISHED",
  filter: (interval: {
    participantSid: string;
    lastSeenAt: Date;
  }) => boolean = () => true,
) {
  const open = await tx.sessionAttendanceInterval.findMany({
    where: { sessionId, leftAt: null },
  });
  // Sequential: each row needs its own max(joinedAt, at) under the held Session lock.
  for (const interval of open.filter(filter)) {
    const leftAt = source === "HEARTBEAT" ? interval.lastSeenAt : at;
    await tx.sessionAttendanceInterval.update({
      where: { id: interval.id },
      data: {
        leftAt: +leftAt >= +interval.joinedAt ? leftAt : interval.joinedAt,
        closeSource: source,
      },
    });
  }
}
