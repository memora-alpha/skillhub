import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./learning-requests-data";

export const teacherId = fixtureId(1);
export const learnerId = fixtureId(2);
export const confirmedAt = "2030-01-01T00:00:00Z";
export function agreementPlan(reverse = false): ApiLearningPlan {
  return {
    id: fixtureId(reverse ? 12 : 11),
    version: 2,
    status: "CONFIRMED",
    teacherId: reverse ? learnerId : teacherId,
    learnerId: reverse ? teacherId : learnerId,
    skillId: fixtureId(20),
    learningGoal: "Thực hành dự án",
    totalSessions: 1,
    learnerConfirmedAt: confirmedAt,
    sessionOutline: [{ sessionNo: 1, content: "Thực hành" }],
    schedule: null,
    sessions: [],
  };
}
export function agreementPath(twoWay = false): ApiLearningPath {
  return {
    id: fixtureId(30),
    conversationId: fixtureId(40),
    status: "CONFIRMED",
    participantAId: teacherId,
    participantBId: learnerId,
    currentVersion: 3,
    lockedVersion: null,
    completedAt: null,
    settledAt: null,
    agreement: {
      version: 3,
      exchangeType: twoWay ? "TWO_WAY" : "ONE_WAY",
      teacherId: twoWay ? null : teacherId,
      learnerId: twoWay ? null : learnerId,
      negotiatedCredit: twoWay ? null : "10.50",
      totalCreditPerUser: twoWay ? "20.00" : null,
      participantAConfirmedAt: confirmedAt,
      participantBConfirmedAt: confirmedAt,
    },
    plans: twoWay ? [agreementPlan(), agreementPlan(true)] : [agreementPlan()],
  };
}
export function withConfirmedSchedules(
  path = agreementPath(),
): ApiLearningPath {
  return {
    ...path,
    plans: path.plans.map((plan, index) => ({
      ...plan,
      schedule: {
        id: fixtureId(50 + index),
        version: 4,
        appliedVersion: null,
        status: "PROPOSED",
        participantAConfirmedAt: confirmedAt,
        participantBConfirmedAt: confirmedAt,
        items: [
          {
            sessionNo: 1,
            startAt: `2030-01-02T${index ? "14" : "10"}:00:00Z`,
            endAt: `2030-01-02T${index ? "15" : "11"}:00:00Z`,
          },
        ],
      },
    })),
  };
}
