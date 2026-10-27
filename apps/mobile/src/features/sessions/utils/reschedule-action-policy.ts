import type { ApiLearningPath } from "@/features/learning-paths";
import { AppError } from "@/lib/http/errors";
import type { RescheduleInput } from "../api/reschedule-api";
import type { LearningSession } from "../types";
import { isRescheduleEligible } from "./reschedule-form";
import type { rescheduleSnapshot } from "./reschedule-snapshot";

export type RescheduleIntent = {
  kind: "propose" | "confirm";
  scheduleId: string;
  version: number;
};
type RescheduleRead = {
  detail: LearningSession;
  path: ApiLearningPath;
  snapshot: NonNullable<ReturnType<typeof rescheduleSnapshot>>;
};

function assertProposal(
  fresh: RescheduleRead,
  input: RescheduleInput | undefined,
  now: () => number,
) {
  if (fresh.snapshot.hasPending)
    throw new AppError("http", 409, "RESCHEDULE_ALREADY_PENDING");
  if (!input || Date.parse(input.startAt) <= now())
    throw new AppError("http", 400, "RESCHEDULE_START_NOT_FUTURE");
  if (
    Date.parse(input.startAt) === Date.parse(fresh.detail.startAt) &&
    Date.parse(input.endAt) === Date.parse(fresh.detail.endAt)
  )
    throw new AppError("http", 400, "RESCHEDULE_UNCHANGED");
}

export function assertRescheduleRequest(
  fresh: RescheduleRead,
  request: RescheduleIntent,
  input: RescheduleInput | undefined,
  now: () => number,
) {
  const { snapshot } = fresh;
  if (
    snapshot.scheduleId !== request.scheduleId ||
    snapshot.version !== request.version
  )
    throw new AppError("http", 409, "STALE_SCHEDULE_VERSION");
  if (
    !isRescheduleEligible(fresh.detail, now()) ||
    !["SCHEDULED", "ACTIVE"].includes(fresh.path.status)
  )
    throw new AppError("http", 409, "SESSION_CANNOT_BE_RESCHEDULED");
  if (request.kind === "propose") {
    assertProposal(fresh, input, now);
    return;
  }
  if (!snapshot.pending || snapshot.ownConfirmed)
    throw new AppError("http", 409, "RESCHEDULE_NOT_CONFIRMABLE");
}

export function isUncertainRescheduleError(error: unknown) {
  if (!(error instanceof AppError)) return true;
  return (
    error.kind === "network" ||
    error.kind === "protocol" ||
    error.status === 408 ||
    error.status >= 500
  );
}
