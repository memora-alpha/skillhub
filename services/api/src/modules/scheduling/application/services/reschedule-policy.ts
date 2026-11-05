import { ConflictException } from "@nestjs/common";
import type { Session } from "../../../../generated/prisma/client";

type Position = Pick<
  Session,
  "id" | "planId" | "planVersion" | "outlineSessionNo" | "startAt" | "endAt"
>;

/** Ordinary changes keep the original plan order and cannot roll the last deadline forward. */
export function assertReschedulePolicy(
  session: Pick<Session, "rescheduleCount" | "originalStartAt"> & Position,
  candidate: { startAt: Date; endAt: Date },
  sessions: Position[],
) {
  if (session.rescheduleCount >= 3)
    throw new ConflictException("SESSION_RESCHEDULE_LIMIT_REACHED");
  const direction = sessions.filter(
    (row) =>
      row.planId === session.planId && row.planVersion === session.planVersion,
  );
  const next = direction
    .filter((row) => row.outlineSessionNo > session.outlineSessionNo)
    .sort((a, b) => a.outlineSessionNo - b.outlineSessionNo)[0];
  const previous = direction
    .filter((row) => row.outlineSessionNo < session.outlineSessionNo)
    .sort((a, b) => b.outlineSessionNo - a.outlineSessionNo)[0];
  if (
    (next && candidate.endAt > next.startAt) ||
    (previous && candidate.startAt < previous.endAt)
  )
    throw new ConflictException("RESCHEDULE_SESSION_ORDER_VIOLATION");
  if (
    !next &&
    +candidate.startAt >
      +(session.originalStartAt ?? session.startAt) + 48 * 3_600_000
  )
    throw new ConflictException("LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED");
}
