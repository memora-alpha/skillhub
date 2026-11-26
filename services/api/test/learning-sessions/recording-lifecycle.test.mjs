import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import {
  finalizedOneWay,
  setup,
  B,
  C,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import { SessionRecordingService } from "../../dist/modules/learning-sessions/application/services/session-recording.service.js";
import { SessionRecordingEventsService } from "../../dist/modules/learning-sessions/application/services/session-recording-events.service.js";
import { SessionRecordingRetentionService } from "../../dist/modules/learning-sessions/application/services/session-recording-retention.service.js";
import { SessionRecordingRetentionWorker } from "../../dist/modules/learning-sessions/infrastructure/jobs/session-recording-retention.worker.js";
import { SessionRecordingNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/session-recording-notification.handler.js";

const PERMISSION = "session-recording:manage:participant";
const person = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [PERMISSION],
});

function fakeEgress() {
  let next = 1;
  return {
    available: true,
    async start() {
      return { egressId: `EG_${next++}` };
    },
    async stop() {},
    async list() {
      return [];
    },
    async setIndicator() {},
  };
}

function fakeStorage() {
  const storage = {
    signed: [],
    removed: [],
    failSign: false,
    failRemove: false,
    async signGet(key, input) {
      if (storage.failSign) throw new Error("storage down");
      storage.signed.push({ key, ...input });
      return `https://objects.example.invalid/${key}?signature=test`;
    },
    async remove(key) {
      if (storage.failRemove) throw new Error("storage down");
      storage.removed.push(key);
    },
  };
  return storage;
}

// Session 2026-11-02 10:00–11:00 UTC. 90-day retention ends 2027-01-31 11:00 UTC.
const EXPIRES = new Date("2027-01-31T11:00:00Z");

async function ready(config = {}) {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "recording.enabled": true,
      "recording.kind": "ROOM_COMPOSITE_VIDEO",
      "recording.retentionDays": 90,
      "recording.overrunMinutes": 10,
      "recording.monthlyAlertMinutes": 0,
      ...config,
    },
  });
  const ids = await finalizedOneWay(ctx);
  const sessionId = ids.session.id;
  await ctx.db.session.update({
    where: { id: sessionId },
    data: { roomName: `skillhub-session-${sessionId}` },
  });
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  const egress = fakeEgress();
  const storage = fakeStorage();
  const recordings = new SessionRecordingService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    egress,
    storage,
  );
  const events = new SessionRecordingEventsService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    egress,
  );
  const retention = new SessionRecordingRetentionService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    storage,
  );
  const teacher = person(ids.session.teacherId);
  const learner = person(ids.session.learnerId);
  let egressCount = 0;
  /** A recording both accepted, finished by Egress with a file: READY. */
  const readyRecording = async (durationMs = 60_000n) => {
    const { id } = await recordings.request(learner, sessionId);
    await recordings.accept(teacher, sessionId, id);
    egressCount += 1;
    await events.applyEgress(ctx.db, {
      egressId: `EG_${egressCount}`,
      status: "COMPLETE",
      startedAt: new Date("2026-11-02T10:05:10Z"),
      endedAt: new Date("2026-11-02T10:06:10Z"),
      file: { bytes: 4096n, durationMs },
    });
    return id;
  };
  const row = (id) => ctx.db.rows("sessionRecording").find((r) => r.id === id);
  const outbox = (type) =>
    ctx.db.rows("outboxEvent").filter((event) => event.type === type);
  const openReport = (status = "OPEN") => {
    const id = randomUUID();
    ctx.db.seed("reportCase", {
      id,
      reporterId: learner.userId,
      targetType: "SESSION",
      targetId: sessionId,
      relatedSessionId: null,
      reasonCode: "QUALITY",
      description: "Lesson content was wrong",
      status,
      handlerId: null,
      blocksSettlement: false,
    });
    return id;
  };
  return {
    ...ctx,
    sessionId,
    storage,
    recordings,
    retention,
    teacher,
    learner,
    readyRecording,
    row,
    outbox,
    openReport,
  };
}

const conflict = (promise, message, status) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConflictException);
    assert.equal(error.getResponse().message, message);
    if (status) assert.equal(error.getResponse().status, status);
    return true;
  });

test("participants get a five-minute inline URL for a READY recording", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  ctx.clock.now = new Date("2026-11-03T08:00:00Z");
  const playback = await ctx.recordings.playback(
    ctx.teacher,
    ctx.sessionId,
    id,
  );
  const key = `recordings/${ctx.sessionId}/${id}.mp4`;
  assert.equal(
    playback.url,
    `https://objects.example.invalid/${key}?signature=test`,
  );
  assert.equal(playback.mime, "video/mp4");
  assert.deepEqual(playback.expiresAt, new Date("2026-11-03T08:05:00Z"));
  assert.deepEqual(ctx.storage.signed, [
    { key, expiresInSeconds: 300, disposition: "inline", mime: "video/mp4" },
  ]);
  await assert.rejects(
    ctx.recordings.playback(person(C), ctx.sessionId, id),
    (error) => error.getStatus() === 403,
  );
});

test("audio-only recordings play as audio/mp4", async () => {
  const ctx = await ready({ "recording.kind": "AUDIO_ONLY" });
  const id = await ctx.readyRecording();
  const playback = await ctx.recordings.playback(
    ctx.learner,
    ctx.sessionId,
    id,
  );
  assert.equal(playback.mime, "audio/mp4");
});

test("playback needs a READY, unexpired recording unless a report holds it", async () => {
  const ctx = await ready();
  const { id: pending } = await ctx.recordings.request(
    ctx.learner,
    ctx.sessionId,
  );
  await conflict(
    ctx.recordings.playback(ctx.learner, ctx.sessionId, pending),
    "RECORDING_NOT_READY",
  );
  await ctx.recordings.decline(ctx.teacher, ctx.sessionId, pending);
  const id = await ctx.readyRecording();
  ctx.clock.now = EXPIRES;
  await conflict(
    ctx.recordings.playback(ctx.learner, ctx.sessionId, id),
    "RECORDING_NOT_READY",
  );
  ctx.openReport("UNDER_REVIEW");
  const held = await ctx.recordings.playback(ctx.learner, ctx.sessionId, id);
  assert.equal(held.mime, "video/mp4");
});

test("a storage failure while signing is a 503", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  ctx.storage.failSign = true;
  await assert.rejects(
    ctx.recordings.playback(ctx.learner, ctx.sessionId, id),
    (error) =>
      error instanceof ServiceUnavailableException &&
      error.getResponse().message === "RECORDING_UNAVAILABLE",
  );
});

test("either participant deletes a recording for both, once", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  const deleted = await ctx.recordings.remove(ctx.teacher, ctx.sessionId, id);
  assert.equal(deleted.status, "DELETED");
  assert.ok(deleted.deletedAt instanceof Date);
  const key = `recordings/${ctx.sessionId}/${id}.mp4`;
  assert.deepEqual(ctx.storage.removed, [key]);
  assert.equal(ctx.row(id).objectKey, null);
  assert.equal(ctx.row(id).deletedByUserId, ctx.teacher.userId);
  const [event] = ctx.outbox("session.recording.deleted");
  assert.deepEqual(event.payload, {
    sessionId: ctx.sessionId,
    recordingId: id,
    deletedByUserId: ctx.teacher.userId,
  });

  const again = await ctx.recordings.remove(ctx.learner, ctx.sessionId, id);
  assert.equal(again.status, "DELETED");
  assert.equal(ctx.outbox("session.recording.deleted").length, 1);
  assert.equal(ctx.row(id).deletedByUserId, ctx.teacher.userId);
  await conflict(
    ctx.recordings.playback(ctx.learner, ctx.sessionId, id),
    "RECORDING_NOT_READY",
  );
});

test("an open report blocks deletion until it closes", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  const caseId = ctx.openReport("NEED_MORE_INFO");
  await conflict(
    ctx.recordings.remove(ctx.learner, ctx.sessionId, id),
    "RECORDING_HELD_BY_REPORT",
  );
  assert.equal(ctx.row(id).status, "READY");
  assert.equal(ctx.storage.removed.length, 0);
  const { items } = await ctx.recordings.list(ctx.learner, ctx.sessionId);
  assert.equal(items[0].heldByReport, true);
  await ctx.db.reportCase.update({
    where: { id: caseId },
    data: { status: "RESOLVED" },
  });
  const deleted = await ctx.recordings.remove(ctx.learner, ctx.sessionId, id);
  assert.equal(deleted.status, "DELETED");
});

test("only READY recordings can be deleted", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  await ctx.recordings.accept(ctx.teacher, ctx.sessionId, id);
  await conflict(
    ctx.recordings.remove(ctx.learner, ctx.sessionId, id),
    "RECORDING_STATE_CONFLICT",
    "STARTING",
  );
});

test("a failed object removal is retried by the retention sweep", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  ctx.storage.failRemove = true;
  const deleted = await ctx.recordings.remove(ctx.learner, ctx.sessionId, id);
  assert.equal(deleted.status, "DELETED");
  assert.notEqual(ctx.row(id).objectKey, null);
  ctx.storage.failRemove = false;
  assert.equal(await ctx.retention.removeObjects(100), 1);
  assert.equal(ctx.row(id).objectKey, null);
  assert.equal(await ctx.retention.removeObjects(100), 0);
});

test("recordings expire after the retention days and their objects are removed", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  ctx.clock.now = new Date(+EXPIRES - 1);
  assert.deepEqual(await ctx.retention.expirePage(100), {
    expired: 0,
    next: null,
  });
  ctx.clock.now = EXPIRES;
  const worker = new SessionRecordingRetentionWorker(ctx.retention);
  const sweep = await worker.sweep();
  assert.equal(sweep.expired, 1);
  assert.equal(sweep.removed, 1);
  const expired = ctx.row(id);
  assert.equal(expired.status, "EXPIRED");
  assert.deepEqual(expired.deletedAt, EXPIRES);
  assert.equal(expired.deletedByUserId, null);
  assert.equal(expired.objectKey, null);
  // The metadata row stays listed for both participants.
  const { items } = await ctx.recordings.list(ctx.learner, ctx.sessionId);
  assert.equal(items[0].status, "EXPIRED");
  assert.equal(items[0].expiresAt, null);
});

test("an open report holds expiry until it closes", async () => {
  const ctx = await ready();
  const id = await ctx.readyRecording();
  const caseId = ctx.openReport();
  ctx.clock.now = new Date("2027-03-01T00:00:00Z");
  assert.equal((await ctx.retention.expirePage(100)).expired, 0);
  assert.equal(ctx.row(id).status, "READY");
  await ctx.db.reportCase.update({
    where: { id: caseId },
    data: { status: "CLOSED" },
  });
  assert.equal((await ctx.retention.expirePage(100)).expired, 1);
  assert.equal(ctx.row(id).status, "EXPIRED");
});

test("expiry pages by id", async () => {
  const ctx = await ready();
  const ids = [];
  for (let index = 0; index < 3; index += 1)
    ids.push(await ctx.readyRecording());
  ctx.clock.now = EXPIRES;
  let total = 0;
  let next;
  let pages = 0;
  do {
    const page = await ctx.retention.expirePage(1, next);
    total += page.expired;
    next = page.next ?? undefined;
    pages += 1;
  } while (next);
  assert.equal(total, 3);
  assert.equal(pages, 4);
  assert.ok(ids.every((id) => ctx.row(id).status === "EXPIRED"));
});

test("the monthly minutes alert logs once per month above its threshold", async () => {
  const ctx = await ready({ "recording.monthlyAlertMinutes": 2 });
  await ctx.readyRecording(90_000n);
  await ctx.readyRecording(60_000n);
  const warnings = [];
  ctx.retention.logger = { warn: (line) => warnings.push(line), log() {} };
  assert.equal(await ctx.retention.checkMonthlyMinutes(), 2);
  assert.equal(await ctx.retention.checkMonthlyMinutes(), 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /RECORDING_MONTHLY_MINUTES_ALERT month=2026-11/);

  const off = await ready();
  await off.readyRecording(600_000n);
  off.retention.logger = { warn: () => assert.fail("alert is off"), log() {} };
  assert.equal(await off.retention.checkMonthlyMinutes(), 10);
});

test("a deletion notice reaches only the other participant", async () => {
  const ctx = await ready();
  const sent = [];
  const handler = new SessionRecordingNotificationHandler(
    { register() {} },
    { dispatch: async (message) => sent.push(message) },
    ctx.db,
  );
  const event = (payload) => ({
    eventId: randomUUID(),
    type: "session.recording.deleted",
    version: 1,
    correlationId: randomUUID(),
    payload: {
      sessionId: ctx.sessionId,
      recordingId: randomUUID(),
      ...payload,
    },
  });
  await handler.publish(event({ deletedByUserId: ctx.learner.userId }));
  assert.deepEqual(sent[0].userIds, [ctx.teacher.userId]);
  await assert.rejects(
    handler.publish(event({ deletedByUserId: C })),
    /INVALID_SESSION_RECORDING_EVENT/,
  );
});
