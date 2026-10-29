import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LearningSessionsService } from "../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { ReportsService } from "../dist/modules/reports/application/services/reports.service.js";

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
  const session = {
    id: "session",
    teacherId: userA,
    learnerId: userB,
    pathId: "path",
    planId: "plan",
    status: "CONFIRMED",
    startAt: new Date("2026-11-02T03:00:00Z"),
    endAt: new Date("2026-11-02T04:00:00Z"),
    teacherAttendanceSeconds: 3600n,
    learnerAttendanceSeconds: 0n,
  };
  const service = sessionsService({
    db: {
      session: { findUnique: () => session, findMany: () => [] },
      learningPath: { findUniqueOrThrow: () => ({ lockedVersion: null }) },
    },
  });
  const result = await service.detail({ userId: userB }, "session");

  assert.equal(result.teacherAttendanceSeconds, "3600");
  assert.equal(result.learnerAttendanceSeconds, "0");
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
  const service = new ReportsService({ run: (work) => work(tx) }, {}, {}, {});
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
