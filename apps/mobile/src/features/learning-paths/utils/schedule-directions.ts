import type { ApiLearningPath } from "../api/learning-paths-contract";

// Required directions come from the agreement, not the number of returned plans.
export function scheduleDirections(path: ApiLearningPath, userId?: string) {
  const pairs =
    path.agreement.exchangeType === "TWO_WAY"
      ? [
          [path.participantAId, path.participantBId],
          [path.participantBId, path.participantAId],
        ]
      : [[path.agreement.teacherId, path.agreement.learnerId]];
  return pairs
    .filter(([teacherId, learnerId]) => !!teacherId && !!learnerId)
    .map(([teacherId, learnerId]) => ({
      key: `${teacherId}:${learnerId}`,
      mine: teacherId === userId,
      plan: path.plans.find(
        (plan) => plan.teacherId === teacherId && plan.learnerId === learnerId,
      ),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine));
}
