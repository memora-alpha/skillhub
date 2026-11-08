import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  learningStage,
  PathOverviewReader,
  overviewCard,
} from "../dist/modules/learning-paths/application/services/path-overview.reader.js";
import { projectOverview } from "../dist/modules/learning-paths/application/services/path-overview.projection.js";
const actor = { userId: "a" };
const path = {
  id: "p",
  participantAId: "a",
  participantBId: "b",
  currentVersion: 1,
  lockedVersion: 1,
  status: "DISPUTED",
  settledAt: null,
  terminationApprovedAt: null,
  participantASettlementApprovedAt: null,
  participantBSettlementApprovedAt: null,
};
const now = new Date("2026-11-08T12:00:00Z");
const session = (id, teacherId, learnerId, status) => ({
  id,
  pathId: "p",
  planId: id,
  planVersion: 1,
  teacherId,
  learnerId,
  status,
  startAt: new Date("2026-11-08T10:00:00Z"),
  endAt: new Date("2026-11-08T11:00:00Z"),
  teacherFirstJoinedAt: null,
  learnerFirstJoinedAt: null,
  teacherConfirmationStatus: null,
  learnerConfirmationStatus: null,
  confirmDeadlineAt: null,
  makeupDeadlineAt: null,
});
function fixture(
  paths = [path],
  sessions = [
    session("teach", "a", "b", "COMPLETED"),
    session("learn", "b", "a", "COMPLETED"),
  ],
) {
  let queries = 0;
  const tx = {
    $queryRaw: async () => [{ now }],
    learningPath: {
      findUnique: async ({ where }) => paths.find((p) => p.id === where.id),
    },
    learningChangeRequest: {
      findMany: async () => {
        queries++;
        return [];
      },
    },
    pathSettlementAttempt: {
      findMany: async () => {
        queries++;
        return [];
      },
    },
    pathVersionPlan: {
      findMany: async () => {
        queries++;
        return sessions.map((s) => ({
          pathId: s.pathId,
          pathVersion: 1,
          planId: s.planId,
          planVersion: 1,
          ownedPlanRecord: { teacherId: s.teacherId, learnerId: s.learnerId },
          planVersionRecord: { totalSessions: 1 },
        }));
      },
    },
  };
  const reports = [
    {
      id: "system",
      relatedPathId: "p",
      relatedSessionId: "learn",
      reasonCode: "ATTENDANCE_UNVERIFIABLE",
      status: "OPEN",
      blocksSettlement: true,
      createdAt: now,
      resolvedAt: null,
    },
  ];
  const reader = new PathOverviewReader(
    { run: async (work) => work(tx) },
    {
      batch: async () => {
        queries++;
        return sessions.map((s) => ({
          session: s,
          outcome: null,
          excuse: null,
        }));
      },
    },
    {
      batch: async () => {
        queries++;
        return reports;
      },
    },
    {
      getSnapshot: async () => ({
        values: { "session.attendancePolicy": { disputeWindowHours: 48 } },
      }),
    },
  );
  return { reader, tx, queries: () => queries };
}
test("DISPUTED does not conceal completed learning; stopped path wins over settlement", () => {
  const finished = [session("s", "a", "b", "COMPLETED")];
  assert.equal(learningStage(path, finished), "LEARNING_FINISHED");
  assert.equal(
    learningStage({ ...path, status: "CANCELLED", settledAt: now }, finished),
    "STOPPED",
  );
  assert.equal(
    learningStage({ ...path, settledAt: now }, finished),
    "LEARNING_FINISHED",
  );
  assert.equal(learningStage(path, [session("s", "a", "b", "DISPUTED")]), null);
  assert.equal(
    learningStage({ ...path, lockedVersion: null }, []),
    "PREPARING",
  );
});
test("card/detail share two-way progress, system-case attention and exact settlement destination", async () => {
  const { reader } = fixture();
  const view = await reader.read(actor, "p"),
    card = overviewCard(view);
  assert.deepEqual(card.progress, {
    learning: { completed: 1, total: 1 },
    teaching: { completed: 1, total: 1 },
    basis: "LOCKED_AGREEMENT",
  });
  assert.equal(card.learningStage, "LEARNING_FINISHED");
  assert.equal(card.attentionCount, 1);
  assert.equal(card.primaryAttention.reasonCode, "ATTENDANCE_UNVERIFIABLE");
  assert.equal(card.settlement.status, "WAITING_DISPUTE");
  assert.deepEqual(card.settlement.nextActionTarget, {
    type: "CASE_SUMMARY",
    id: "system",
  });
  assert.equal("cases" in card, false);
  assert.equal("attentionItems" in card, false);
});
test("batch queries remain constant with page size and reject nonparticipants", async () => {
  const one = fixture();
  await one.reader.batch(one.tx, actor, [path]);
  const many = fixture();
  await many.reader.batch(many.tx, actor, [path, { ...path, id: "p2" }]);
  assert.equal(one.queries(), many.queries());
  await assert.rejects(
    one.reader.read({ userId: "outsider" }, "p"),
    /LEARNING_PATH_ACCESS_DENIED/,
  );
});
test("attendance/completion actions remain blocked by a disputed path", async () => {
  const waiting = session("teach", "a", "b", "AWAITING_CONFIRMATION");
  waiting.confirmDeadlineAt = new Date("2026-11-09T00:00:00Z");
  const f = fixture([path], [waiting]);
  const view = await f.reader.read(actor, "p");
  const attention = view.attentionItems.find(
    (item) => item.sessionId === "teach",
  );
  assert.equal(
    attention.allowedActions.some((item) => item.code === "CONFIRM_COMPLETION"),
    false,
  );
});

function completedContext() {
  return {
    actor,
    path: { ...path, status: "ACTIVE" },
    now,
    rows: [
      {
        session: session("s", "a", "b", "COMPLETED"),
        outcome: null,
        excuse: null,
      },
    ],
    cases: [],
    changes: [],
    plans: [
      {
        ownedPlanRecord: { teacherId: "a", learnerId: "b" },
        planVersionRecord: { totalSessions: 3 },
      },
    ],
    disputeHours: 48,
  };
}

test("settlement precedence preserves blocked, stopped, draft and incomplete states", () => {
  const initial = completedContext();
  const termination = {
    id: "change",
    kind: "PATH_TERMINATION",
    status: "STAFF_REVIEW",
    requesterId: "b",
    approvedAt: null,
    expiresAt: now,
    sessionId: null,
  };
  const report = {
    id: "case",
    status: "OPEN",
    blocksSettlement: true,
    reasonCode: "ATTENDANCE",
    relatedSessionId: "s",
  };
  const scenarios = [
    [
      {
        ...initial,
        path: { ...initial.path, settledAt: now },
        changes: [termination],
        cases: [report],
      },
      "SETTLED",
    ],
    [
      { ...initial, path: { ...initial.path, status: "CANCELLED" } },
      "TERMINATED",
    ],
    [
      {
        ...initial,
        path: { ...initial.path, lockedVersion: null },
        cases: [report],
      },
      "NOT_LOCKED",
    ],
    [
      { ...initial, changes: [termination], cases: [report] },
      "WAITING_TERMINATION",
    ],
    [{ ...initial, cases: [report] }, "WAITING_DISPUTE"],
    [{ ...initial, rows: [] }, "WAITING_SESSIONS"],
    [
      { ...initial, path: { ...initial.path, status: "DISPUTED" } },
      "NEEDS_REVIEW",
    ],
  ];
  for (const [context, expected] of scenarios) {
    const settlement = projectOverview({
      ...context,
      disputeHours: undefined,
    }).settlement;
    assert.equal(settlement.status, expected);
    assert.equal(settlement.immediateSettlement.canApprove, false);
    assert.equal(settlement.autoSettlementAt, null);
  }
});

test("settlement confirmation window, retries and policy errors retain their distinct actions", () => {
  const context = completedContext();
  let view = projectOverview(context).settlement;
  assert.equal(view.status, "WAITING_DISPUTE_WINDOW");
  assert.equal(view.nextAction, "APPROVE_IMMEDIATE_SETTLEMENT_OR_WAIT");
  assert.equal(view.immediateSettlement.canApprove, true);
  context.path.participantASettlementApprovedAt = now;
  view = projectOverview(context).settlement;
  assert.equal(view.nextAction, "WAIT_FOR_PARTNER_OR_DEADLINE");
  assert.equal(view.immediateSettlement.canApprove, false);
  context.path.participantBSettlementApprovedAt = now;
  assert.equal(projectOverview(context).settlement.status, "READY");
  for (const [outcome, action] of [
    ["RETRYING", "WAIT_FOR_RETRY"],
    ["NEEDS_REVIEW", "CONTACT_SUPPORT"],
  ]) {
    const attempt = {
      outcome,
      errorCode: "SETTLEMENT_FAILED",
      checkedAt: now,
      attemptCount: 2,
    };
    view = projectOverview({ ...context, attempt }).settlement;
    assert.equal(view.status, outcome);
    assert.equal(view.nextAction, action);
    assert.equal(view.reasonCode, "SETTLEMENT_FAILED");
    assert.equal(view.attemptCount, 2);
  }
  assert.throws(
    () => projectOverview({ ...context, disputeHours: undefined }),
    /ATTENDANCE_POLICY_UNAVAILABLE/,
  );
});

test("overview preserves draft progress, next-session role and viewer-action priority", () => {
  const context = completedContext();
  const next = session("next", "b", "a", "CONFIRMED");
  next.startAt = new Date("2026-11-09T10:00:00Z");
  next.endAt = new Date("2026-11-09T11:00:00Z");
  context.rows.push({ session: next, outcome: null, excuse: null });
  let view = projectOverview(context);
  assert.equal(view.primaryAction.code, "VIEW_NEXT_SESSION");
  assert.equal(view.nextSession.role, "LEARNER");
  context.path.lockedVersion = null;
  view = projectOverview(context);
  assert.deepEqual(view.progress.teaching, { completed: 1, total: 3 });
  context.changes.push({
    id: "change",
    kind: "SESSION_RESCHEDULE",
    status: "PENDING",
    requesterId: "b",
    expiresAt: next.startAt,
    approvedAt: null,
    sessionId: "next",
  });
  context.cases.push({
    id: "case",
    status: "OPEN",
    blocksSettlement: true,
    reasonCode: "ATTENDANCE",
    relatedSessionId: "s",
  });
  view = projectOverview(context);
  assert.equal(view.attentionCount, 2);
  assert.equal(view.primaryAttention.waitingOn, "SELF");
  assert.deepEqual(view.primaryAction, {
    code: "VIEW_PROBLEM",
    target: { type: "LEARNING_CHANGE", id: "change" },
  });
});
