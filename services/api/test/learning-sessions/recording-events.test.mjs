import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { EgressStatus } from "livekit-server-sdk";
import {
  fakeOutboxConsumer,
  finalizedOneWay,
  setup,
  B,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import { SessionRecordingService } from "../../dist/modules/learning-sessions/application/services/session-recording.service.js";
import { SessionRecordingEventsService } from "../../dist/modules/learning-sessions/application/services/session-recording-events.service.js";
import { SessionRecordingReconcileWorker } from "../../dist/modules/learning-sessions/infrastructure/jobs/session-recording-reconcile.worker.js";
import {
  egressSnapshot,
  RecordingProviderError,
} from "../../dist/modules/learning-sessions/infrastructure/livekit/livekit-egress.service.js";
import { LiveKitWebhookController } from "../../dist/modules/learning-sessions/presentation/http/livekit-webhook.controller.js";
import { SessionRecordingNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/session-recording-notification.handler.js";

const PERMISSION = "session-recording:manage:participant";
const person = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [PERMISSION],
});
const at = (time) => new Date(`2026-11-02T${time}Z`);

function fakeEgress() {
  const egress = {
    available: true,
    nextId: 1,
    started: [],
    stopped: [],
    indicators: [],
    listed: [],
    async start(input) {
      egress.started.push(input);
      return { egressId: `EG_${egress.nextId++}` };
    },
    async stop(egressId) {
      egress.stopped.push(egressId);
    },
    async list() {
      return egress.listed;
    },
    async setIndicator(roomName, recording) {
      egress.indicators.push({ roomName, recording });
    },
  };
  return egress;
}

const snapshot = (egressId, status, extra = {}) => ({
  egressId,
  status,
  startedAt: null,
  endedAt: null,
  file: null,
  ...extra,
});

// Session 2026-11-02 10:00–11:00 UTC; the room is open 09:50–11:10.
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
  const roomName = `skillhub-session-${sessionId}`;
  await ctx.db.session.update({
    where: { id: sessionId },
    data: { roomName },
  });
  ctx.clock.now = at("09:55:00");
  const egress = fakeEgress();
  const clock = { now: () => ctx.clock.now };
  const recordings = new SessionRecordingService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    clock,
    egress,
  );
  const events = new SessionRecordingEventsService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    egress,
  );
  const teacher = person(ids.session.teacherId);
  const learner = person(ids.session.learnerId);
  /** A learner request the teacher accepted: STARTING with egress EG_n. */
  const started = async () => {
    const { id } = await recordings.request(learner, sessionId);
    await recordings.accept(teacher, sessionId, id);
    return id;
  };
  const row = (id) => ctx.db.rows("sessionRecording").find((r) => r.id === id);
  const outbox = (type) =>
    ctx.db.rows("outboxEvent").filter((event) => event.type === type);
  return {
    ...ctx,
    sessionId,
    roomName,
    egress,
    recordings,
    events,
    teacher,
    learner,
    started,
    row,
    outbox,
  };
}

test("egress events move a recording to RECORDING and READY with its file", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  const live = await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "ACTIVE", { startedAt: at("09:55:05") }),
  );
  assert.deepEqual(live, {
    roomName: ctx.roomName,
    recording: { id, kind: "ROOM_COMPOSITE_VIDEO" },
  });
  assert.equal(ctx.row(id).status, "RECORDING");
  assert.deepEqual(ctx.row(id).startedAt, at("09:55:05"));
  // egress_updated while recording changes nothing.
  assert.equal(
    await ctx.events.applyEgress(ctx.db, snapshot("EG_1", "ACTIVE")),
    null,
  );

  const ended = await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "COMPLETE", {
      endedAt: at("10:55:00"),
      file: { bytes: 5_000_000n, durationMs: 3_595_000n },
    }),
  );
  assert.deepEqual(ended, { roomName: ctx.roomName, recording: null });
  const done = ctx.row(id);
  assert.equal(done.status, "READY");
  assert.equal(done.objectKey, `recordings/${ctx.sessionId}/${id}.mp4`);
  assert.equal(done.bytes, 5_000_000n);
  assert.equal(done.durationMs, 3_595_000n);
  assert.equal(done.stopReason, "ROOM_FINISHED");
  assert.deepEqual(done.endedAt, at("10:55:00"));
});

test("a participant stop keeps its reason when Egress ends", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  await ctx.events.applyEgress(ctx.db, snapshot("EG_1", "ACTIVE"));
  await ctx.recordings.stop(ctx.learner, ctx.sessionId, id);
  await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "COMPLETE", { file: { bytes: 10n, durationMs: 1n } }),
  );
  assert.equal(ctx.row(id).status, "READY");
  assert.equal(ctx.row(id).stopReason, "PARTICIPANT");
});

test("a failed or empty Egress marks the recording FAILED and notifies once", async () => {
  const ctx = await ready();
  const sessionBefore = {
    ...ctx.db.rows("session").find((s) => s.id === ctx.sessionId),
  };
  const id = await ctx.started();
  const change = await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "FAILED"),
  );
  assert.deepEqual(change, { roomName: ctx.roomName, recording: null });
  assert.equal(ctx.row(id).status, "FAILED");
  assert.equal(ctx.row(id).failureCode, "EGRESS_FAILED");
  // A late COMPLETE after FAILED is ignored.
  await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "COMPLETE", { file: { bytes: 1n, durationMs: 1n } }),
  );
  assert.equal(ctx.row(id).status, "FAILED");
  assert.equal(ctx.outbox("session.recording.failed").length, 1);

  const second = await ctx.started();
  await ctx.events.applyEgress(ctx.db, snapshot("EG_2", "COMPLETE"));
  assert.equal(ctx.row(second).failureCode, "EGRESS_NO_FILE");
  // Spec D8: a recording failure never changes the Session or its schedule.
  const sessionAfter = ctx.db
    .rows("session")
    .find((s) => s.id === ctx.sessionId);
  for (const field of ["status", "startAt", "endAt", "teacherId", "learnerId"])
    assert.deepEqual(sessionAfter[field], sessionBefore[field], field);
});

test("unknown Egress ids are ignored", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  assert.equal(
    await ctx.events.applyEgress(ctx.db, snapshot("EG_OTHER", "FAILED")),
    null,
  );
  assert.equal(ctx.row(id).status, "STARTING");
});

test("the webhook routes egress events once and never touches attendance", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  const event = {
    id: "EV_recording_1",
    event: "egress_started",
    egressInfo: {
      egressId: "EG_1",
      status: EgressStatus.EGRESS_ACTIVE,
      startedAt: 1_700_000_000_000_000_000n,
      endedAt: 0n,
      fileResults: [],
    },
  };
  const consumer = fakeOutboxConsumer(ctx.db);
  const sessions = {
    reconcileLiveKitRoom: () => assert.fail("attendance must not run"),
    applyLiveKitActivity: () => assert.fail("attendance must not run"),
  };
  const controller = new LiveKitWebhookController(
    { verifyWebhook: async () => event },
    consumer,
    sessions,
    ctx.events,
  );
  const request = { rawBody: Buffer.from("{}") };
  await controller.receive(request, "signed");
  await controller.receive(request, "signed");
  assert.equal(ctx.row(id).status, "RECORDING");
  assert.deepEqual(ctx.egress.indicators, [
    {
      roomName: ctx.roomName,
      recording: { id, kind: "ROOM_COMPOSITE_VIDEO" },
    },
  ]);
  assert.deepEqual(ctx.row(id).startedAt, new Date(1_700_000_000_000));
});

test("an indicator failure is logged, not thrown", async () => {
  const ctx = await ready();
  ctx.egress.setIndicator = async () => {
    throw new RecordingProviderError("ROOM_METADATA_FAILED");
  };
  await ctx.events.syncIndicator({ roomName: "room", recording: null });
});

test("reconcile expires unanswered requests", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  ctx.clock.now = at("09:57:00");
  const summary = await ctx.events.reconcile();
  assert.equal(summary.expiredRequests, 1);
  assert.equal(ctx.row(id).status, "REQUEST_EXPIRED");
});

test("reconcile stops a recording at its cap, then at the window close", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  await ctx.events.applyEgress(
    ctx.db,
    snapshot("EG_1", "ACTIVE", { startedAt: at("09:55:00") }),
  );
  // Cap: 09:55 + 60 min + 10 min = 11:05, before the 11:10 close.
  ctx.clock.now = at("11:04:59");
  assert.equal((await ctx.events.reconcile()).stopped, 0);
  ctx.clock.now = at("11:05:00");
  assert.equal((await ctx.events.reconcile()).stopped, 1);
  assert.equal(ctx.row(id).status, "STOPPING");
  assert.equal(ctx.row(id).stopReason, "MAX_DURATION");
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);

  const late = await ready();
  late.clock.now = at("10:30:00");
  const lateId = await late.started();
  await late.events.applyEgress(
    late.db,
    snapshot("EG_1", "ACTIVE", { startedAt: at("10:30:00") }),
  );
  late.clock.now = at("11:10:00");
  await late.events.reconcile();
  assert.equal(late.row(lateId).stopReason, "WINDOW_CLOSED");
});

test("turning recording off stops active recordings", async () => {
  const ctx = await ready();
  const id = await ctx.started();
  ctx.configuration.values["recording.enabled"] = false;
  assert.equal((await ctx.events.reconcile()).stopped, 1);
  assert.equal(ctx.row(id).stopReason, "DISABLED");
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);
});

test("reconcile repairs stuck rows from the provider list", async () => {
  const ctx = await ready();
  // STARTING with a lost egress_started: the provider says it is active.
  const active = await ctx.started();
  ctx.egress.listed = [snapshot("EG_1", "ACTIVE")];
  ctx.clock.now = at("09:58:00");
  assert.equal((await ctx.events.reconcile()).repaired, 1);
  assert.equal(ctx.row(active).status, "RECORDING");

  // STOPPING whose stop call was lost: stop it again.
  await ctx.recordings.stop(ctx.learner, ctx.sessionId, active);
  ctx.egress.stopped = [];
  ctx.clock.now = at("10:01:00");
  await ctx.events.reconcile();
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);

  // The provider finished it while the webhook went missing.
  ctx.egress.listed = [
    snapshot("EG_1", "COMPLETE", { file: { bytes: 9n, durationMs: 9n } }),
  ];
  ctx.clock.now = at("10:04:00");
  await ctx.events.reconcile();
  assert.equal(ctx.row(active).status, "READY");
});

test("reconcile fails rows the provider no longer knows or never started", async () => {
  const ctx = await ready();
  const lost = await ctx.started();
  ctx.egress.listed = [];
  ctx.clock.now = at("09:58:00");
  await ctx.events.reconcile();
  assert.equal(ctx.row(lost).status, "FAILED");
  assert.equal(ctx.row(lost).failureCode, "EGRESS_LOST");

  // The API stopped between accepting and calling Egress.
  ctx.clock.now = at("10:00:00");
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  await ctx.db.sessionRecording.update({
    where: { id },
    data: { status: "STARTING", acceptedByUserId: ctx.teacher.userId },
  });
  ctx.clock.now = at("10:03:00");
  await ctx.events.reconcile();
  assert.equal(ctx.row(id).status, "FAILED");
  assert.equal(ctx.row(id).failureCode, "EGRESS_START_LOST");
  assert.equal(ctx.outbox("session.recording.failed").length, 2);
});

test("the worker never overlaps passes", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let calls = 0;
  const worker = new SessionRecordingReconcileWorker({
    async reconcile() {
      calls += 1;
      await gate;
      return { expiredRequests: 0, stopped: 0, repaired: 0 };
    },
  });
  const first = worker.sweep();
  assert.equal(await worker.sweep(), null);
  release();
  assert.deepEqual(await first, {
    expiredRequests: 0,
    stopped: 0,
    repaired: 0,
  });
  assert.equal(calls, 1);
  worker.onModuleDestroy();
  assert.equal(await worker.sweep(), null);
});

test("requests and start failures emit notification events", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  const [requested] = ctx.outbox("session.recording.requested");
  assert.deepEqual(requested.payload, {
    sessionId: ctx.sessionId,
    recordingId: id,
    requestedByUserId: ctx.learner.userId,
  });
  ctx.egress.start = async () => {
    throw new RecordingProviderError("EGRESS_START_FAILED");
  };
  await ctx.recordings.accept(ctx.teacher, ctx.sessionId, id);
  assert.equal(ctx.outbox("session.recording.failed").length, 1);
});

test("notifications reach the other participant for requests and both for failures", async () => {
  const ctx = await ready();
  const sent = [];
  const handler = new SessionRecordingNotificationHandler(
    { register() {} },
    { dispatch: async (message) => sent.push(message) },
    ctx.db,
  );
  const recordingId = "11111111-1111-4111-8111-111111111111";
  const event = (type, payload) => ({
    eventId: "22222222-2222-4222-8222-222222222222",
    type,
    version: 1,
    correlationId: "33333333-3333-4333-8333-333333333333",
    payload,
  });
  await handler.publish(
    event("session.recording.requested", {
      sessionId: ctx.sessionId,
      recordingId,
      requestedByUserId: ctx.learner.userId,
    }),
  );
  await handler.publish(
    event("session.recording.failed", {
      sessionId: ctx.sessionId,
      recordingId,
    }),
  );
  assert.deepEqual(sent[0].userIds, [ctx.teacher.userId]);
  assert.deepEqual(
    sent[1].userIds.toSorted(),
    [ctx.learner.userId, ctx.teacher.userId].toSorted(),
  );
  assert.deepEqual(sent[1].payload, { sessionId: ctx.sessionId, recordingId });
  await assert.rejects(
    handler.publish(
      event("session.recording.requested", {
        sessionId: ctx.sessionId,
        recordingId,
      }),
    ),
    /INVALID_SESSION_RECORDING_EVENT/,
  );
});

test("egress snapshots convert provider nanoseconds and keep only safe fields", () => {
  const base = {
    egressId: "EG_9",
    startedAt: 1_700_000_000_123_000_000n,
    endedAt: 1_700_000_060_000_000_000n,
    error: "s3 secret=private-value",
  };
  assert.deepEqual(
    egressSnapshot({
      ...base,
      status: EgressStatus.EGRESS_LIMIT_REACHED,
      fileResults: [{ size: 2048n, duration: 59_000_000_000n }],
    }),
    {
      egressId: "EG_9",
      status: "COMPLETE",
      startedAt: new Date(1_700_000_000_123),
      endedAt: new Date(1_700_000_060_000),
      file: { bytes: 2048n, durationMs: 59_000n },
    },
  );
  const empty = egressSnapshot({
    ...base,
    status: EgressStatus.EGRESS_ABORTED,
    startedAt: 0n,
    fileResults: [{ size: 0n, duration: 0n }],
  });
  assert.equal(empty.status, "FAILED");
  assert.equal(empty.startedAt, null);
  assert.equal(empty.file, null);
  assert.ok(
    !JSON.stringify(empty, (_, v) =>
      typeof v === "bigint" ? `${v}` : v,
    ).includes("private-value"),
  );
});
