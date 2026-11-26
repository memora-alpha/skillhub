import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  finalizedOneWay,
  setup,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import { SessionWhiteboardService } from "../../dist/modules/learning-sessions/application/services/session-whiteboard.service.js";
import { SessionWhiteboardRetentionWorker } from "../../dist/modules/learning-sessions/infrastructure/jobs/session-whiteboard-retention.worker.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";

const STAFF = "0d0d0d0d-0000-4000-8000-00000000000d";
const OTHER_STAFF = "0e0e0e0e-0000-4000-8000-00000000000e";
const staff = (userId = STAFF, permissions = ["report:moderate"]) => ({
  userId,
  roles: ["STAFF"],
  permissions,
});
const participant = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [
    "session:read:participant",
    "session-whiteboard:update:participant",
  ],
});
const scene = (...ids) => ({
  elements: ids.map((id) => ({
    id,
    type: "rectangle",
    version: 1,
    versionNonce: 7,
  })),
});

// Session 2026-11-02 10:00-11:00 UTC; 30-day retention expires it at 2026-12-02 11:00.
async function ready() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "whiteboard.editWindow": { teacherPrepare: true, afterEndMinutes: 1440 },
      "whiteboard.retentionDays": 30,
    },
  });
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  const whiteboards = new SessionWhiteboardService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    new AuditWriter(new AuditRepository()),
  );
  await whiteboards.save(participant(A), ids.session.id, 0, scene("a"));
  return { ...ctx, ...ids, whiteboards };
}

function seedCase(ctx, overrides = {}) {
  const id = randomUUID();
  ctx.db.seed("reportCase", {
    id,
    reporterId: B,
    targetType: "SESSION",
    targetId: ctx.session.id,
    relatedSessionId: null,
    reasonCode: "QUALITY",
    description: "Lesson content was wrong",
    status: "UNDER_REVIEW",
    handlerId: STAFF,
    blocksSettlement: false,
    ...overrides,
  });
  return id;
}

test("the assigned handler reads the board of an open case, audited", async () => {
  const ctx = await ready();
  const caseId = seedCase(ctx);
  const audits = ctx.db.rows("auditLog").length;
  const board = await ctx.whiteboards.staffRead(
    staff(),
    ctx.session.id,
    caseId,
  );
  assert.equal(board.caseId, caseId);
  assert.equal(board.revision, 1);
  assert.deepEqual(
    board.sceneData.elements.map((e) => e.id),
    ["a"],
  );
  const logs = ctx.db.rows("auditLog");
  assert.equal(logs.length, audits + 1);
  const log = logs.at(-1);
  assert.equal(log.action, "REPORT_EVIDENCE_READ");
  assert.equal(log.targetType, "SESSION_WHITEBOARD");
  assert.equal(log.targetId, ctx.session.id);
});

test("a case that only relates to the Session also grants the read", async () => {
  const ctx = await ready();
  const caseId = seedCase(ctx, {
    targetType: "USER",
    targetId: A,
    relatedSessionId: ctx.session.id,
    status: "NEED_MORE_INFO",
  });
  const board = await ctx.whiteboards.staffRead(
    staff(),
    ctx.session.id,
    caseId,
  );
  assert.equal(board.revision, 1);
});

test("staff read is refused without permission, assignment, open status or session link", async () => {
  const ctx = await ready();
  const caseId = seedCase(ctx);
  const audits = ctx.db.rows("auditLog").length;
  await assert.rejects(
    () => ctx.whiteboards.staffRead(staff(STAFF, []), ctx.session.id, caseId),
    { message: "STAFF_ACCESS_REQUIRED" },
  );
  await assert.rejects(
    () =>
      ctx.whiteboards.staffRead(
        { ...participant(C), permissions: ["report:moderate"] },
        ctx.session.id,
        caseId,
      ),
    { message: "STAFF_ACCESS_REQUIRED" },
  );
  await assert.rejects(
    () => ctx.whiteboards.staffRead(staff(OTHER_STAFF), ctx.session.id, caseId),
    { message: "REPORT_CASE_NOT_ASSIGNED_TO_CALLER" },
  );
  await assert.rejects(
    () => ctx.whiteboards.staffRead(staff(), ctx.session.id, randomUUID()),
    { message: "REPORT_CASE_NOT_FOUND" },
  );
  await assert.rejects(
    () => ctx.whiteboards.staffRead(staff(), randomUUID(), caseId),
    { message: "SESSION_NOT_IN_REPORT_CASE" },
  );
  for (const status of ["RESOLVED", "REJECTED", "CLOSED"]) {
    const closed = seedCase(ctx, { status });
    await assert.rejects(
      () => ctx.whiteboards.staffRead(staff(), ctx.session.id, closed),
      { message: "REPORT_CASE_NOT_OPEN" },
    );
  }
  assert.equal(ctx.db.rows("auditLog").length, audits);
});

test("retention deletes scenes 30 days after endAt", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2026-12-02T10:59:59Z");
  assert.deepEqual(await ctx.whiteboards.purgeExpired(100), {
    deleted: 0,
    next: null,
  });
  ctx.clock.now = new Date("2026-12-02T11:00:00Z");
  assert.deepEqual(await ctx.whiteboards.purgeExpired(100), {
    deleted: 1,
    next: null,
  });
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 0);
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.revision, 0);
  assert.equal(board.sceneData, null);
  assert.equal(board.readOnly, true);
});

test("an open report holds the scene until it closes", async () => {
  const ctx = await ready();
  const caseId = seedCase(ctx, {
    targetType: "USER",
    targetId: A,
    relatedSessionId: ctx.session.id,
  });
  ctx.clock.now = new Date("2027-01-15T00:00:00Z");
  const worker = new SessionWhiteboardRetentionWorker(ctx.whiteboards);
  assert.equal(await worker.sweep(), 0);
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 1);
  await ctx.db.reportCase.update({
    where: { id: caseId },
    data: { status: "RESOLVED" },
  });
  assert.equal(await worker.sweep(), 1);
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 0);
});

test("held rows do not stall paging", async () => {
  const ctx = await ready();
  seedCase(ctx);
  ctx.clock.now = new Date("2027-01-15T00:00:00Z");
  assert.deepEqual(await ctx.whiteboards.purgeExpired(1), {
    deleted: 0,
    next: ctx.session.id,
  });
  assert.deepEqual(await ctx.whiteboards.purgeExpired(1, ctx.session.id), {
    deleted: 0,
    next: null,
  });
});

test("missing retention configuration deletes nothing", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2027-01-15T00:00:00Z");
  ctx.configuration.getSnapshot = async () => {
    throw new ServiceUnavailableException("Configuration not ready");
  };
  const worker = new SessionWhiteboardRetentionWorker(ctx.whiteboards);
  await assert.rejects(() => worker.sweep(), ServiceUnavailableException);
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 1);
});

test("an open report freezes the board for both parties until it closes", async () => {
  const ctx = await ready();
  const caseId = seedCase(ctx, { status: "OPEN" });
  for (const userId of [A, B]) {
    const board = await ctx.whiteboards.read(
      participant(userId),
      ctx.session.id,
    );
    assert.equal(board.readOnly, true);
    assert.equal(board.readOnlyReason, "SESSION_UNDER_REPORT");
    assert.equal(board.editableUntil, null);
    await assert.rejects(
      () =>
        ctx.whiteboards.save(
          participant(userId),
          ctx.session.id,
          1,
          scene("x"),
        ),
      (error) =>
        error.getStatus() === 409 &&
        error.getResponse().message === "WHITEBOARD_READ_ONLY" &&
        error.getResponse().reason === "SESSION_UNDER_REPORT",
    );
  }
  assert.equal(ctx.db.rows("sessionWhiteboard")[0].revision, 1);
  await ctx.db.reportCase.update({
    where: { id: caseId },
    data: { status: "REJECTED" },
  });
  const saved = await ctx.whiteboards.save(
    participant(A),
    ctx.session.id,
    1,
    scene("a", "b"),
  );
  assert.equal(saved.revision, 2);
});

test("a report that only relates to the Session also freezes the board", async () => {
  const ctx = await ready();
  seedCase(ctx, {
    targetType: "USER",
    targetId: A,
    relatedSessionId: ctx.session.id,
    status: "NEED_MORE_INFO",
  });
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnlyReason, "SESSION_UNDER_REPORT");
});

test("a report on another Session leaves the board editable", async () => {
  const ctx = await ready();
  seedCase(ctx, { targetId: randomUUID() });
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnly, false);
  assert.equal(board.readOnlyReason, null);
});
