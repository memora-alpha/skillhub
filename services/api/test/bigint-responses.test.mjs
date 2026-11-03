import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LearningSessionsService } from "../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { ReportsService } from "../dist/modules/reports/application/services/reports.service.js";

import {
  setup,
  finalizedOneWay,
  user,
  A,
  B,
} from "./learning-platform/fixtures.mjs";

const userA = "0a0a0a0a-0000-4000-8000-00000000000a";
const userB = "0b0b0b0b-0000-4000-8000-00000000000b";

function sessionsService({ tx = {}, db = {} }) {
  if (tx.learningPath?.findUniqueOrThrow)
    tx.learningPath.findUnique = tx.learningPath.findUniqueOrThrow;
  return new LearningSessionsService(
    { run: (work) => work(tx) },
    db,
    {},
    {},
    {},
    {},
    { getSnapshot: async () => ({ values: {} }) },
    { config: { enabled: false } },
    { now: () => new Date("2026-11-02T00:00:00Z") },
    {},
    {
      readPathSource: async () => ({
        requestId: null,
        conversationId: "conversation",
        participantAId: userA,
        participantBId: userB,
      }),
    },
  );
}

test("session detail returns attendance seconds as strings", async () => {
  const ctx = setup({ wallets: { [B]: 10000n } });
  const { session } = await finalizedOneWay(ctx);
  ctx.db.seed("sessionAttendanceOutcome", {
    sessionId: session.id,
    occurrenceStartAt: session.startAt,
    occurrenceEndAt: session.endAt,
    attendanceCase: "BOTH_PRESENT",
    status: "FINAL",
    resolution: null,
    teacherVerdict: "PRESENT",
    learnerVerdict: "PRESENT",
    teacherLate: false,
    learnerLate: false,
    teacherSeconds: 3600n,
    learnerSeconds: 3600n,
    teacherFirstJoinedAt: session.startAt,
    learnerFirstJoinedAt: session.startAt,
    determinedAt: new Date(+session.endAt + 600000),
    finalizesAt: new Date(+session.endAt + 48 * 3600000),
    evidence: {},
  });
  const result = await ctx.sessions.detail(user(A), session.id);
  assert.equal(result.attendance.teacher.seconds, "3600");
  assert.equal(result.attendance.learner.seconds, "3600");
  assert.equal("teacherAttendanceSeconds" in result, false);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("an already settled path returns settlement amounts as credit text", async () => {
  const tx = {
    $queryRaw: () => [{ id: "path" }],
    learningPath: {
      findUniqueOrThrow: () => ({
        participantAId: userA,
        participantBId: userB,
        status: "COMPLETED",
        settledAt: new Date("2026-10-15T00:00:00.000Z"),
        settlementOperationId: "operation",
        settlementGrossAmount: 10000n,
        settlementFeeAmount: 405n,
      }),
    },
  };
  const result = await sessionsService({ tx }).settlePath(
    { userId: userA },
    "path",
  );

  assert.deepEqual(result, {
    pathId: "path",
    status: "COMPLETED",
    operationId: "operation",
    gross: "100.00",
    fee: "4.05",
  });
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("report lists return evidence sizes as strings", async () => {
  const cases = [
    {
      id: "case",
      reportEvidenceCaseIdRecords: [
        { id: "evidence", mimeType: "image/png", fileSizeBytes: 2048n },
      ],
    },
  ];
  const tx = { reportCase: { findMany: () => cases } };
  const service = new ReportsService(
    { run: (work) => work(tx) },
    {},
    {},
    {},
    undefined,
    undefined,
    {
      getSnapshot: async () => ({
        values: { "session.attendancePolicy": { disputeWindowHours: 48 } },
      }),
    },
  );
  const staff = {
    userId: userA,
    roles: ["STAFF"],
    permissions: ["report:moderate"],
  };

  for (const result of [
    await service.listMine({ userId: userB }),
    await service.staffQueue(staff),
  ]) {
    assert.equal(
      result[0].reportEvidenceCaseIdRecords[0].fileSizeBytes,
      "2048",
    );
    assert.doesNotThrow(() => JSON.stringify(result));
  }
});
