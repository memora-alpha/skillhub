import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { finalizedOneWay, setup, B } from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import { SessionRecordingService } from "../../dist/modules/learning-sessions/application/services/session-recording.service.js";
import { SessionRecordingEventsService } from "../../dist/modules/learning-sessions/application/services/session-recording-events.service.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";

const STAFF = "0d0d0d0d-0000-4000-8000-00000000000d";
const OTHER_STAFF = "0e0e0e0e-0000-4000-8000-00000000000e";
const staff = (
  userId = STAFF,
  permissions = ["report:moderate"],
  roles = ["STAFF"],
) => ({ userId, roles, permissions });
const participant = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: ["session-recording:manage:participant"],
});

function fakeStorage() {
  const storage = {
    signed: [],
    fail: false,
    async signGet(key, input) {
      if (storage.fail) throw new Error("storage down");
      storage.signed.push({ key, ...input });
      return `https://objects.example.invalid/${key}?signature=test`;
    },
    async remove() {},
  };
  return storage;
}

// Session 2026-11-02 10:00–11:00 UTC.
async function ready() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "recording.enabled": true,
      "recording.kind": "ROOM_COMPOSITE_VIDEO",
      "recording.retentionDays": 90,
      "recording.overrunMinutes": 10,
      "recording.monthlyAlertMinutes": 0,
    },
  });
  const ids = await finalizedOneWay(ctx);
  const sessionId = ids.session.id;
  await ctx.db.session.update({
    where: { id: sessionId },
    data: { roomName: `skillhub-session-${sessionId}` },
  });
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  const egress = {
    available: true,
    async start() {
      return { egressId: "EG_1" };
    },
    async stop() {},
    async list() {
      return [];
    },
    async setIndicator() {},
  };
  const storage = fakeStorage();
  const recordings = new SessionRecordingService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    egress,
    storage,
    new AuditWriter(new AuditRepository()),
  );
  const events = new SessionRecordingEventsService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    egress,
  );
  const learner = participant(ids.session.learnerId);
  const teacher = participant(ids.session.teacherId);
  const { id: recordingId } = await recordings.request(learner, sessionId);
  await recordings.accept(teacher, sessionId, recordingId);
  await events.applyEgress(ctx.db, {
    egressId: "EG_1",
    status: "COMPLETE",
    startedAt: new Date("2026-11-02T10:05:10Z"),
    endedAt: new Date("2026-11-02T10:55:00Z"),
    file: { bytes: 4096n, durationMs: 3_000_000n },
  });
  const seedCase = (overrides = {}) => {
    const id = randomUUID();
    ctx.db.seed("reportCase", {
      id,
      reporterId: learner.userId,
      targetType: "SESSION",
      targetId: sessionId,
      relatedSessionId: null,
      reasonCode: "QUALITY",
      description: "Lesson content was wrong",
      status: "UNDER_REVIEW",
      handlerId: STAFF,
      blocksSettlement: false,
      ...overrides,
    });
    return id;
  };
  const audits = () =>
    ctx.db
      .rows("auditLog")
      .filter((log) => log.targetType === "SESSION_RECORDING");
  return {
    ...ctx,
    sessionId,
    recordingId,
    storage,
    recordings,
    learner,
    teacher,
    seedCase,
    audits,
  };
}

const refused = (promise, status, message) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.getStatus(), status);
    assert.equal(error.getResponse().message ?? error.message, message);
    return true;
  });

test("the handler of an open case watches the recording, audited per URL", async () => {
  const ctx = await ready();
  const caseId = ctx.seedCase();
  const review = await ctx.recordings.staffReview(
    staff(),
    ctx.sessionId,
    ctx.recordingId,
    caseId,
  );
  const key = `recordings/${ctx.sessionId}/${ctx.recordingId}.mp4`;
  assert.equal(review.caseId, caseId);
  assert.equal(review.mime, "video/mp4");
  assert.equal(
    review.url,
    `https://objects.example.invalid/${key}?signature=test`,
  );
  assert.deepEqual(review.expiresAt, new Date("2026-11-02T10:10:00Z"));
  assert.deepEqual(ctx.storage.signed, [
    { key, expiresInSeconds: 300, disposition: "inline", mime: "video/mp4" },
  ]);
  await ctx.recordings.staffReview(
    staff(),
    ctx.sessionId,
    ctx.recordingId,
    caseId,
  );
  const logs = ctx.audits();
  assert.equal(logs.length, 2);
  assert.equal(logs[0].action, "REPORT_EVIDENCE_READ");
  assert.equal(logs[0].targetId, ctx.recordingId);
  assert.equal(logs[0].actorId, STAFF);
  assert.deepEqual(logs[0].after, { caseId, access: "READ" });
});

test("a case that only relates to the Session grants the review, even past expiry", async () => {
  const ctx = await ready();
  const caseId = ctx.seedCase({
    targetType: "USER",
    targetId: ctx.teacher.userId,
    relatedSessionId: ctx.sessionId,
    status: "NEED_MORE_INFO",
  });
  ctx.clock.now = new Date("2027-03-01T00:00:00Z");
  const review = await ctx.recordings.staffReview(
    staff(),
    ctx.sessionId,
    ctx.recordingId,
    caseId,
  );
  assert.equal(review.caseId, caseId);
});

test("staff review refuses in order and refused requests write no audit", async () => {
  const ctx = await ready();
  const caseId = ctx.seedCase();
  const review = (actor, overrides = {}) =>
    ctx.recordings.staffReview(
      actor,
      overrides.sessionId ?? ctx.sessionId,
      overrides.recordingId ?? ctx.recordingId,
      overrides.caseId ?? caseId,
    );
  await refused(review(staff(STAFF, [])), 403, "STAFF_ACCESS_REQUIRED");
  await refused(
    review(staff(STAFF, ["report:moderate"], ["USER"])),
    403,
    "STAFF_ACCESS_REQUIRED",
  );
  await refused(
    review(staff(), { caseId: randomUUID() }),
    404,
    "REPORT_CASE_NOT_FOUND",
  );
  await refused(
    review(staff(OTHER_STAFF)),
    403,
    "REPORT_CASE_NOT_ASSIGNED_TO_CALLER",
  );
  const closed = ctx.seedCase({ status: "RESOLVED" });
  await refused(
    review(staff(), { caseId: closed }),
    409,
    "REPORT_CASE_NOT_OPEN",
  );
  const elsewhere = ctx.seedCase({ targetId: randomUUID() });
  await refused(
    review(staff(), { caseId: elsewhere }),
    404,
    "SESSION_NOT_IN_REPORT_CASE",
  );
  await refused(
    review(staff(), { recordingId: randomUUID() }),
    404,
    "RECORDING_NOT_FOUND",
  );
  ctx.storage.fail = true;
  await refused(review(staff()), 503, "RECORDING_UNAVAILABLE");
  assert.equal(ctx.audits().length, 0);
  assert.equal(ctx.storage.signed.length, 0);
});

test("staff review needs a READY recording and Admin has no other path", async () => {
  const ctx = await ready();
  const caseId = ctx.seedCase();
  // The open case also keeps participants from deleting the evidence.
  await refused(
    ctx.recordings.remove(ctx.learner, ctx.sessionId, ctx.recordingId),
    409,
    "RECORDING_HELD_BY_REPORT",
  );
  await ctx.db.sessionRecording.update({
    where: { id: ctx.recordingId },
    data: { status: "FAILED" },
  });
  await refused(
    ctx.recordings.staffReview(staff(), ctx.sessionId, ctx.recordingId, caseId),
    409,
    "RECORDING_NOT_READY",
  );
  // Admin with report:moderate still has to be the case handler.
  await refused(
    ctx.recordings.staffReview(
      staff(OTHER_STAFF, ["report:moderate"], ["ADMIN"]),
      ctx.sessionId,
      ctx.recordingId,
      caseId,
    ),
    403,
    "REPORT_CASE_NOT_ASSIGNED_TO_CALLER",
  );
  // Participant routes stay closed to Staff.
  await refused(
    ctx.recordings.playback(
      { ...staff(), permissions: ["session-recording:manage:participant"] },
      ctx.sessionId,
      ctx.recordingId,
    ),
    403,
    "SESSION_ACCESS_DENIED",
  );
  assert.equal(ctx.audits().length, 0);
});
