import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./learning-requests-data";

export const journeyIds = {
  path: fixtureId(700),
  conversation: fixtureId(600),
  me: fixtureId(1),
  other: fixtureId(2),
};
const at = "2026-10-19T12:00:00.000Z";
export function journeyPlan(teacher = journeyIds.me): ApiLearningPlan {
  return {
    id: fixtureId(teacher === journeyIds.me ? 701 : 702),
    version: 1,
    status: "PROPOSED",
    teacherId: teacher,
    learnerId: teacher === journeyIds.me ? journeyIds.other : journeyIds.me,
    skillId: fixtureId(teacher === journeyIds.me ? 10 : 11),
    learningGoal: "Tự làm một dự án thực hành",
    totalSessions: 1,
    learnerConfirmedAt: null,
    sessionOutline: [{ sessionNo: 1, content: "Thực hành với dự án đầu tiên" }],
    schedule: null,
    sessions: [],
  };
}
export function journeyPath(ready = false): ApiLearningPath {
  const path: ApiLearningPath = {
    id: journeyIds.path,
    conversationId: journeyIds.conversation,
    participantAId: journeyIds.me,
    participantBId: journeyIds.other,
    status: "PROPOSED",
    currentVersion: 1,
    lockedVersion: null,
    completedAt: null,
    settledAt: null,
    agreement: {
      version: 1,
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "40.00",
      negotiatedCredit: null,
      teacherId: null,
      learnerId: null,
      participantAConfirmedAt: null,
      participantBConfirmedAt: null,
    },
    plans: [journeyPlan(), journeyPlan(journeyIds.other)],
  };
  if (ready) {
    path.status = "CONFIRMED";
    path.agreement.participantAConfirmedAt = at;
    path.agreement.participantBConfirmedAt = at;
    path.plans.forEach((plan, i) => {
      plan.status = "CONFIRMED";
      plan.learnerConfirmedAt = at;
      plan.schedule = {
        id: fixtureId(710 + i),
        version: 1,
        appliedVersion: null,
        status: "PARTIALLY_CONFIRMED",
        participantAConfirmedAt: at,
        participantBConfirmedAt: at,
        items: [
          {
            sessionNo: 1,
            startAt: new Date(Date.now() + (i + 2) * 86400000).toISOString(),
            endAt: new Date(
              Date.now() + (i + 2) * 86400000 + 5400000,
            ).toISOString(),
          },
        ],
      };
    });
  }
  return path;
}
