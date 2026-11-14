import type { ApiLearningPath } from "@/features/learning-paths";

/** Reviews address the participant who taught the viewer in this path. */
export function teacherReviewPlan(path: ApiLearningPath, userId?: string) {
  if (!userId || ![path.participantAId, path.participantBId].includes(userId))
    return undefined;
  const teacherId =
    path.participantAId === userId ? path.participantBId : path.participantAId;
  if (
    path.agreement.exchangeType === "ONE_WAY" &&
    (path.agreement.teacherId !== teacherId ||
      path.agreement.learnerId !== userId)
  )
    return undefined;
  return path.plans.find(
    (plan) => plan.learnerId === userId && plan.teacherId === teacherId,
  );
}
