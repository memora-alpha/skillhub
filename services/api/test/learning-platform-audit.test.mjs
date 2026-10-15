import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditWriter } from "../dist/modules/audit/application/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/audit.repository.js";
import { ReputationService } from "../dist/modules/reputation/reputation.service.js";
import { SchedulingService } from "../dist/modules/scheduling/scheduling.service.js";

const userId = "8f6f1c52-5d0f-4a39-9d6b-0d8f0f5f2a11";
const now = new Date("2026-10-20T00:00:00.000Z");

function reputationFixture({ score, active = [] }) {
  const audits = [];
  const created = [];
  const revoked = [];
  const tx = {
    reputationHistory: { findUnique: () => null, create: () => ({}) },
    $queryRaw: () => [{ id: userId }],
    user: {
      findUniqueOrThrow: () => ({ reputationScore: score }),
      update: () => ({}),
    },
    userRestriction: {
      findMany: ({ where }) =>
        active.filter((row) => !where.scope || row.scope === where.scope),
      updateMany: ({ where }) => revoked.push(...where.id.in),
      create: ({ data }) => created.push(data),
    },
    auditLog: { create: ({ data }) => audits.push(data) },
  };
  const service = new ReputationService(new AuditWriter(new AuditRepository()));
  const apply = (delta) =>
    service.apply(tx, {
      userId,
      delta,
      reasonCode: "RATING",
      sourceType: "REVIEW",
      sourceId: "review",
      eventKey: `event:${delta}`,
      now,
    });
  return { apply, audits, created, revoked };
}

test("restriction apply is audited with the superseded and new restrictions", async () => {
  const shorter = {
    id: "r1",
    scope: "CREATE_NEW_ACTIVITY",
    endsAt: new Date("2026-10-21T00:00:00.000Z"),
  };
  const fixture = reputationFixture({ score: 30, active: [shorter] });
  await fixture.apply(-5);

  assert.deepEqual(fixture.revoked, ["r1"]);
  assert.equal(fixture.created.length, 1);
  assert.equal(fixture.audits.length, 1);
  const [audit] = fixture.audits;
  assert.equal(audit.action, "USER_RESTRICTION_APPLY");
  assert.equal(audit.systemActor, "reputation-policy");
  assert.equal(audit.targetType, "USER");
  assert.equal(audit.targetId, userId);
  assert.deepEqual(audit.before, {
    restrictions: [
      { scope: "CREATE_NEW_ACTIVITY", endsAt: "2026-10-21T00:00:00.000Z" },
    ],
  });
  assert.deepEqual(audit.after, {
    score: 25,
    restrictions: [
      { scope: "CREATE_NEW_ACTIVITY", endsAt: "2026-10-23T00:00:00.000Z" },
    ],
  });
});

test("an unchanged longer restriction writes no audit", async () => {
  const longer = {
    id: "r1",
    scope: "CREATE_NEW_ACTIVITY",
    endsAt: new Date("2026-12-01T00:00:00.000Z"),
  };
  const fixture = reputationFixture({ score: 30, active: [longer] });
  await fixture.apply(-5);

  assert.deepEqual(fixture.created, []);
  assert.deepEqual(fixture.audits, []);
});

test("recovering to 40 revokes low-reputation restrictions with one audit", async () => {
  const restriction = {
    id: "r1",
    scope: "CREATE_NEW_ACTIVITY",
    endsAt: new Date("2026-10-23T00:00:00.000Z"),
  };
  const recovered = reputationFixture({ score: 38, active: [restriction] });
  await recovered.apply(5);

  assert.deepEqual(recovered.revoked, ["r1"]);
  assert.equal(recovered.audits.length, 1);
  assert.equal(recovered.audits[0].action, "USER_RESTRICTION_REVOKE");
  assert.deepEqual(recovered.audits[0].after, { score: 43, restrictions: [] });

  const clean = reputationFixture({ score: 60 });
  await clean.apply(1);
  assert.deepEqual(clean.revoked, []);
  assert.deepEqual(clean.audits, []);
});

test("an applied reschedule is audited with old and new session times", async () => {
  const pathId = "0f1d4a3e-6c1a-4b7e-8b44-2a5d1c3e9f10";
  const scheduleId = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
  const sessionId = "6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d";
  const participantB = "1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b";
  const session = {
    id: sessionId,
    status: "CONFIRMED",
    startAt: new Date("2026-10-21T10:00:00.000Z"),
    endAt: new Date("2026-10-21T11:00:00.000Z"),
  };
  const item = (id, scheduleVersion, startAt, endAt) => ({
    id,
    scheduleVersion,
    planId: "plan",
    planVersion: 1,
    sessionNo: 1,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
  });
  const items = [
    item("old", 1, "2026-10-21T10:00:00.000Z", "2026-10-21T11:00:00.000Z"),
    item("new", 2, "2026-10-22T10:00:00.000Z", "2026-10-22T11:00:00.000Z"),
  ];
  const version = {
    pathVersion: 1,
    participantAConfirmedAt: now,
    participantBConfirmedAt: null,
  };
  const audits = [];
  const sessionUpdates = [];
  const tx = {
    $queryRaw: (strings) =>
      strings.join("").includes("CURRENT_TIMESTAMP")
        ? [{ now }]
        : [{ id: "locked" }],
    scheduleProposal: {
      findUnique: () => ({
        pathId,
        currentVersion: 2,
        appliedVersion: 1,
        status: "NEEDS_REVISION",
        pathIdRecord: {
          participantAId: userId,
          participantBId: participantB,
          status: "SCHEDULED",
          currentVersion: 1,
        },
      }),
      update: () => ({}),
    },
    scheduleVersion: {
      findUniqueOrThrow: () => ({ ...version }),
      update: ({ data }) => Object.assign(version, data),
    },
    scheduleItem: {
      findMany: ({ where }) =>
        items.filter((row) => row.scheduleVersion === where.scheduleVersion),
    },
    sessionScheduleHistory: {
      findMany: () => [
        { id: "history", scheduleItemId: "old", sessionIdRecord: session },
      ],
      updateMany: () => ({}),
      createMany: () => ({}),
    },
    session: { update: ({ data }) => sessionUpdates.push(data) },
    auditLog: { create: ({ data }) => audits.push(data) },
  };
  const service = new SchedulingService(
    { run: (work) => work(tx) },
    new AuditWriter(new AuditRepository()),
    {
      getSnapshot: async () => ({
        values: { "schedule.rescheduleCutoffMinutes": 60 },
      }),
    },
  );

  const result = await service.confirmProposal(
    { userId: participantB, roles: ["USER"], permissions: [] },
    scheduleId,
    2,
  );

  assert.equal(result.status, "LOCKED");
  assert.equal(sessionUpdates.length, 1);
  assert.equal(audits.length, 1);
  const [audit] = audits;
  assert.equal(audit.action, "SCHEDULE_RESCHEDULE");
  assert.equal(audit.actorId, participantB);
  assert.deepEqual(audit.actorRoles, ["USER"]);
  assert.equal(audit.targetType, "SCHEDULE_PROPOSAL");
  assert.equal(audit.targetId, scheduleId);
  assert.deepEqual(audit.before, {
    appliedVersion: 1,
    sessions: [
      {
        sessionId,
        startAt: "2026-10-21T10:00:00.000Z",
        endAt: "2026-10-21T11:00:00.000Z",
      },
    ],
  });
  assert.deepEqual(audit.after, {
    appliedVersion: 2,
    sessions: [
      {
        sessionId,
        startAt: "2026-10-22T10:00:00.000Z",
        endAt: "2026-10-22T11:00:00.000Z",
      },
    ],
  });
});
