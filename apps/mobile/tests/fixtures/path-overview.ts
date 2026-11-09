import type { PathOverview } from "../../src/features/learning-paths/api/path-overview-contract";
import { fixtureId } from "./learning-requests-data";
import { settlementFixture } from "./path-changes-data";

export function overviewFixture(): PathOverview {
  const pathId = fixtureId(30);
  const caseId = fixtureId(71);
  const target = { type: "CASE_SUMMARY", id: caseId };
  const item = {
    key: `case:${caseId}`,
    type: "REPORT_CASE",
    reasonCode: "NO_SHOW_LATE",
    status: "UNDER_REVIEW",
    waitingOn: "STAFF",
    sessionId: null,
    deadline: null,
    blocksSettlement: true,
    target,
    allowedActions: [{ code: "VIEW_CASE_SUMMARY", target }],
  };
  return {
    evaluatedAt: "2030-01-01T00:00:00Z",
    learningStage: "LEARNING",
    stageReasonCode: null,
    progress: {
      learning: { completed: 1, total: 3 },
      teaching: { completed: 2, total: 4 },
      basis: "LOCKED_AGREEMENT",
    },
    nextSession: {
      id: fixtureId(61),
      planId: fixtureId(11),
      startAt: "2030-01-02T10:00:00Z",
      endAt: "2030-01-02T11:00:00Z",
      role: "LEARNER",
      status: "CONFIRMED",
    },
    attentionCount: 1,
    primaryAttention: item,
    primaryAction: { code: "VIEW_PROBLEM", target },
    settlement: {
      ...settlementFixture(),
      pathId,
      status: "WAITING_DISPUTE",
      nextActionTarget: target,
      relatedItems: [target],
    },
    attentionItems: [item],
  };
}
export function participantCaseFixture() {
  return {
    id: fixtureId(71),
    relatedPathId: fixtureId(30),
    relatedSessionId: null,
    reasonCode: "NO_SHOW_LATE",
    status: "UNDER_REVIEW",
    blocksSettlement: true,
    createdAt: "2030-01-01T00:00:00Z",
    resolvedAt: null,
  };
}
