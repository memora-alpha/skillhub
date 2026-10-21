import { AppError } from "@/lib/http/errors";
import { parse } from "@/lib/http/contracts";
import {
  learningPathSchema,
  type ApiLearningPlan,
} from "./learning-paths-contract";

function validSchedule(plan: ApiLearningPlan) {
  const schedule = plan.schedule;
  if (!schedule) return true;
  const items = schedule.items;
  return (
    items.length <= plan.totalSessions &&
    (schedule.status === "NEEDS_REVISION" ||
      items.length === plan.totalSessions) &&
    new Set(items.map((item) => item.sessionNo)).size === items.length &&
    items.every((item) => item.sessionNo <= plan.totalSessions)
  );
}

export function readLearningPath(
  response: unknown,
  id: string,
  userId: string,
) {
  const path = parse(learningPathSchema, response);
  const participants = [path.participantAId, path.participantBId];
  if (
    path.id !== id ||
    !participants.includes(userId) ||
    participants[0] === participants[1] ||
    path.agreement.version !== path.currentVersion ||
    new Set(path.plans.map((plan) => plan.id)).size !== path.plans.length ||
    path.plans.some(
      (plan) =>
        !participants.includes(plan.teacherId) ||
        !participants.includes(plan.learnerId) ||
        plan.teacherId === plan.learnerId ||
        plan.sessionOutline.length !== plan.totalSessions ||
        plan.sessionOutline.some(
          (item, index) => item.sessionNo !== index + 1,
        ) ||
        !validSchedule(plan),
    )
  )
    throw new AppError("protocol");
  for (const plan of path.plans)
    plan.schedule?.items.sort((a, b) => a.sessionNo - b.sessionNo);
  return path;
}
