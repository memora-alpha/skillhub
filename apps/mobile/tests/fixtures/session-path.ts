import { agreementPath, withConfirmedSchedules } from "./learning-agreement";
import { sessionRecord } from "./sessions-client";
import type { LearningSession } from "../../src/features/sessions/types";

export function sessionPath(reverse = false) {
  const path = withConfirmedSchedules(agreementPath(true));
  path.lockedVersion = path.currentVersion;
  path.status = "SCHEDULED";
  const plan = path.plans[reverse ? 1 : 0]!;
  const schedule = plan.schedule!;
  schedule.appliedVersion = schedule.version;
  schedule.status = "LOCKED";
  const session: LearningSession = {
    ...sessionRecord(),
    status: "CONFIRMED",
    pathId: path.id,
    planId: plan.id,
    planVersion: plan.version,
    outlineSessionNo: 1,
    teacherId: plan.teacherId,
    learnerId: plan.learnerId,
    startAt: schedule.items[0]!.startAt,
    endAt: schedule.items[0]!.endAt,
    role: "TEACHER",
  };
  plan.sessions = [
    {
      id: session.id,
      sessionNo: 1,
      startAt: session.startAt,
      endAt: session.endAt,
      status: session.status,
    },
  ];
  return { path, plan, schedule, session };
}
