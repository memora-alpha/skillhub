import type { ApiLearningPath } from "../../src/features/learning-paths/api/learning-paths-contract";

export function scheduleTimeDetails(path: ApiLearningPath) {
  return {
    evaluatedAt: "2030-01-02T12:00:00.000Z",
    durationMinutes: { min: 45, max: 120 },
    invalidItems: path.plans.map((plan) => ({
      planId: plan.id,
      planVersion: plan.version,
      scheduleId: plan.schedule!.id,
      scheduleVersion: plan.schedule!.version,
      teacherId: plan.teacherId,
      learnerId: plan.learnerId,
      ...plan.schedule!.items[0]!,
      startAt: new Date(plan.schedule!.items[0]!.startAt).toISOString(),
      endAt: new Date(plan.schedule!.items[0]!.endAt).toISOString(),
      reasons: ["START_NOT_IN_FUTURE" as const],
    })),
  };
}
