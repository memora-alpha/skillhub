import type { ApiLearningPath } from "@/features/learning-paths";
import type { LearningSession } from "../types";

export function resolveSessionContext(
  session: LearningSession,
  path: ApiLearningPath,
) {
  if (path.id !== session.pathId || !path.lockedVersion) return;
  const plan = path.plans.find((item) => item.id === session.planId);
  if (
    !plan ||
    plan.version !== session.planVersion ||
    plan.teacherId !== session.teacherId ||
    plan.learnerId !== session.learnerId
  )
    return;
  const actual = plan.sessions.find((item) => item.id === session.id);
  const outline = plan.sessionOutline.find(
    (item) => item.sessionNo === session.outlineSessionNo,
  );
  if (!actual || !outline || actual.sessionNo !== outline.sessionNo) return;
  return { path, plan, actual, outline };
}
export type SessionContext = NonNullable<
  ReturnType<typeof resolveSessionContext>
>;

// Summary fields only: this projection cannot authorize completion.
export function pathSessionItems(path: ApiLearningPath) {
  return path.plans
    .flatMap((plan) =>
      plan.sessions.map((session) => ({
        ...session,
        pathId: path.id,
        planId: plan.id,
        teacherId: plan.teacherId,
        learnerId: plan.learnerId,
      })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.id.localeCompare(b.id),
    );
}
