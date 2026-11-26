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
import { RecordingProviderError } from "../../dist/modules/learning-sessions/infrastructure/livekit/livekit-egress.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

const PERMISSION = "session-recording:manage:participant";
const person = (userId, permissions = [PERMISSION]) => ({
  userId,
  roles: ["USER"],
  permissions,
});

function fakeEgress() {
  const egress = {
    available: true,
    started: [],
    stopped: [],
    nextId: 1,
    onStart: null,
    async start(input) {
      egress.started.push(input);
      if (egress.onStart) await egress.onStart(input);
      return { egressId: `EG_${egress.nextId++}` };
    },
    async stop(egressId) {
      egress.stopped.push(egressId);
    },
    async list() {
      return [];
    },
    async setIndicator() {},
  };
  return egress;
}

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
  const roomName = `skillhub-session-${ids.session.id}`;
  await ctx.db.session.update({
    where: { id: ids.session.id },
    data: { roomName },
  });
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  const egress = fakeEgress();
  const recordings = new SessionRecordingService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
    egress,
  );
  const teacher = person(ids.session.teacherId);
  const learner = person(ids.session.learnerId);
  return {
    ...ctx,
    ...ids,
    sessionId: ids.session.id,
    roomName,
    egress,
    recordings,
    teacher,
    learner,
  };
}

const rejects = (promise, Type, message, status) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof Type, `${error?.constructor?.name}`);
    const response = error.getResponse();
    assert.equal(response.message, message);
    if (status) assert.equal(response.status, status);
    return true;
  });

const forbidden = (promise, message) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.getStatus(), 403);
    assert.equal(error.getResponse().message, message);
    return true;
  });

test("a request starts recording only after the other participant accepts", async () => {
  const ctx = await ready();
  const requested = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  assert.equal(requested.status, "REQUESTED");
  assert.equal(requested.requestedByUserId, ctx.learner.userId);
  assert.equal(requested.acceptedByUserId, null);
  assert.equal(ctx.egress.started.length, 0);

  const accepted = await ctx.recordings.accept(
    ctx.teacher,
    ctx.sessionId,
    requested.id,
  );
  assert.equal(accepted.status, "STARTING");
  assert.equal(accepted.acceptedByUserId, ctx.teacher.userId);
  assert.deepEqual(ctx.egress.started, [
    {
      roomName: ctx.roomName,
      objectKey: `recordings/${ctx.sessionId}/${requested.id}.mp4`,
      kind: "ROOM_COMPOSITE_VIDEO",
    },
  ]);
  assert.equal(ctx.db.rows("sessionRecording")[0].egressId, "EG_1");
});

test("either participant stops; stopping again is idempotent", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.teacher, ctx.sessionId);
  await ctx.recordings.accept(ctx.learner, ctx.sessionId, id);
  const stopped = await ctx.recordings.stop(ctx.learner, ctx.sessionId, id);
  assert.equal(stopped.status, "STOPPING");
  assert.equal(stopped.stopReason, "PARTICIPANT");
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);
  const again = await ctx.recordings.stop(ctx.teacher, ctx.sessionId, id);
  assert.equal(again.status, "STOPPING");
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);
  const row = ctx.db.rows("sessionRecording")[0];
  assert.equal(row.stoppedByUserId, ctx.learner.userId);
});

test("a stop that lands while Egress is starting stops the new Egress", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  ctx.egress.onStart = () =>
    ctx.recordings.stop(ctx.learner, ctx.sessionId, id);
  const accepted = await ctx.recordings.accept(ctx.teacher, ctx.sessionId, id);
  assert.equal(accepted.status, "STOPPING");
  assert.deepEqual(ctx.egress.stopped, ["EG_1"]);
});

test("only the other participant answers, and only with the permission", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  await forbidden(
    ctx.recordings.accept(ctx.learner, ctx.sessionId, id),
    "RECORDING_ACTION_NOT_ALLOWED",
  );
  await forbidden(
    ctx.recordings.decline(ctx.learner, ctx.sessionId, id),
    "RECORDING_ACTION_NOT_ALLOWED",
  );
  await forbidden(
    ctx.recordings.accept(person(C), ctx.sessionId, id),
    "SESSION_ACCESS_DENIED",
  );
  await forbidden(
    ctx.recordings.accept(
      person(ctx.teacher.userId, ["session:read:participant"]),
      ctx.sessionId,
      id,
    ),
    "SESSION_ACCESS_DENIED",
  );
  await forbidden(
    ctx.recordings.request(person(C), ctx.sessionId),
    "SESSION_ACCESS_DENIED",
  );
  await assert.rejects(
    ctx.recordings.accept(ctx.teacher, ctx.sessionId, randomUUID()),
    (error) => error.getResponse().message === "RECORDING_NOT_FOUND",
  );
  assert.equal(ctx.egress.started.length, 0);
});

test("a declined request cannot be accepted and frees the Session for a new one", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  await rejects(
    ctx.recordings.request(ctx.teacher, ctx.sessionId),
    ConflictException,
    "RECORDING_ALREADY_ACTIVE",
  );
  const declined = await ctx.recordings.decline(ctx.teacher, ctx.sessionId, id);
  assert.equal(declined.status, "DECLINED");
  await rejects(
    ctx.recordings.accept(ctx.teacher, ctx.sessionId, id),
    ConflictException,
    "RECORDING_STATE_CONFLICT",
    "DECLINED",
  );
  // Stopping a finished row is idempotent rather than a conflict.
  const stopped = await ctx.recordings.stop(ctx.teacher, ctx.sessionId, id);
  assert.equal(stopped.status, "DECLINED");
  const next = await ctx.recordings.request(ctx.teacher, ctx.sessionId);
  assert.equal(next.status, "REQUESTED");
});

test("a pending request cannot be stopped; it must be answered", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  await rejects(
    ctx.recordings.stop(ctx.learner, ctx.sessionId, id),
    ConflictException,
    "RECORDING_STATE_CONFLICT",
    "REQUESTED",
  );
});

test("an unanswered request expires after two minutes", async () => {
  const ctx = await ready();
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  ctx.clock.now = new Date("2026-11-02T10:07:00Z");
  await rejects(
    ctx.recordings.accept(ctx.teacher, ctx.sessionId, id),
    ConflictException,
    "RECORDING_STATE_CONFLICT",
    "REQUEST_EXPIRED",
  );
  const { items } = await ctx.recordings.list(ctx.learner, ctx.sessionId);
  assert.equal(items[0].status, "REQUEST_EXPIRED");
  // A new request persists the expiry and takes the slot.
  const next = await ctx.recordings.request(ctx.teacher, ctx.sessionId);
  assert.equal(next.status, "REQUESTED");
  assert.equal(
    ctx.db.rows("sessionRecording").find((row) => row.id === id).status,
    "REQUEST_EXPIRED",
  );
  assert.equal(ctx.egress.started.length, 0);
});

test("requests are refused outside the room window or before the room exists", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2026-11-02T09:49:00Z");
  await rejects(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    ConflictException,
    "RECORDING_WINDOW_NOT_OPEN",
  );
  ctx.clock.now = new Date("2026-11-02T11:00:00Z");
  await rejects(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    ConflictException,
    "RECORDING_WINDOW_NOT_OPEN",
  );
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  await ctx.db.session.update({
    where: { id: ctx.sessionId },
    data: { roomName: null },
  });
  await rejects(
    ctx.recordings.request(ctx.learner, ctx.sessionId),
    ConflictException,
    "RECORDING_ROOM_NOT_STARTED",
  );
});

test("accepting after the window closed does not start Egress", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2026-11-02T10:59:30Z");
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  ctx.clock.now = new Date("2026-11-02T11:00:30Z");
  await rejects(
    ctx.recordings.accept(ctx.teacher, ctx.sessionId, id),
    ConflictException,
    "RECORDING_WINDOW_NOT_OPEN",
  );
  assert.equal(ctx.egress.started.length, 0);
});

test("the kill switch, a missing provider and missing configuration refuse requests", async () => {
  const off = await ready({ "recording.enabled": false });
  await rejects(
    off.recordings.request(off.learner, off.sessionId),
    ServiceUnavailableException,
    "RECORDING_DISABLED",
  );
  const unavailable = await ready();
  unavailable.egress.available = false;
  await rejects(
    unavailable.recordings.request(unavailable.learner, unavailable.sessionId),
    ServiceUnavailableException,
    "RECORDING_UNAVAILABLE",
  );
  const missing = await ready();
  missing.configuration.getSnapshot = async () => {
    throw new ServiceUnavailableException("CONFIGURATION_NOT_READY");
  };
  await rejects(
    missing.recordings.request(missing.learner, missing.sessionId),
    ServiceUnavailableException,
    "RECORDING_UNAVAILABLE",
  );
});

test("a failed Egress start marks the recording FAILED and frees the slot", async () => {
  const ctx = await ready();
  ctx.egress.start = async () => {
    throw new RecordingProviderError("EGRESS_START_FAILED");
  };
  const { id } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  const failed = await ctx.recordings.accept(ctx.teacher, ctx.sessionId, id);
  assert.equal(failed.status, "FAILED");
  const row = ctx.db.rows("sessionRecording")[0];
  assert.equal(row.failureCode, "EGRESS_START_FAILED");
  assert.equal(row.egressId, null);
  const next = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  assert.equal(next.status, "REQUESTED");
});

test("audio-only configuration records audio only", async () => {
  const ctx = await ready({ "recording.kind": "AUDIO_ONLY" });
  const { id, kind } = await ctx.recordings.request(ctx.learner, ctx.sessionId);
  assert.equal(kind, "AUDIO_ONLY");
  await ctx.recordings.accept(ctx.teacher, ctx.sessionId, id);
  assert.equal(ctx.egress.started[0].kind, "AUDIO_ONLY");
});

test("the list is newest first, carries expiry for READY rows and the report hold", async () => {
  const ctx = await ready();
  ctx.db.seed("sessionRecording", {
    id: randomUUID(),
    sessionId: ctx.sessionId,
    requestedByUserId: ctx.learner.userId,
    acceptedByUserId: ctx.teacher.userId,
    status: "READY",
    kind: "ROOM_COMPOSITE_VIDEO",
    egressId: "EG_OLD",
    objectKey: "recordings/old.mp4",
    bytes: 1024n,
    durationMs: 60_000n,
    requestedAt: new Date("2026-11-02T10:00:00Z"),
    startedAt: new Date("2026-11-02T10:00:10Z"),
    endedAt: new Date("2026-11-02T10:01:10Z"),
  });
  await ctx.recordings.request(ctx.learner, ctx.sessionId);
  let { items } = await ctx.recordings.list(ctx.teacher, ctx.sessionId);
  assert.deepEqual(
    items.map((item) => item.status),
    ["REQUESTED", "READY"],
  );
  assert.equal(items[0].expiresAt, null);
  assert.deepEqual(items[1].expiresAt, new Date("2027-01-31T11:00:00Z"));
  assert.equal(items[1].bytes, 1024);
  assert.equal(items[1].durationMs, 60_000);
  assert.ok(items.every((item) => item.heldByReport === false));
  assert.ok(
    items.every((item) => !("objectKey" in item) && !("egressId" in item)),
  );

  ctx.db.seed("reportCase", {
    id: randomUUID(),
    reporterId: ctx.learner.userId,
    targetType: "USER",
    targetId: ctx.teacher.userId,
    relatedSessionId: ctx.sessionId,
    reasonCode: "QUALITY",
    description: "Lesson content was wrong",
    status: "OPEN",
    handlerId: null,
    blocksSettlement: false,
  });
  ({ items } = await ctx.recordings.list(ctx.learner, ctx.sessionId));
  assert.ok(items.every((item) => item.heldByReport === true));
  await forbidden(
    ctx.recordings.list(person(C), ctx.sessionId),
    "SESSION_ACCESS_DENIED",
  );
});

test("the error filter exposes only a known recording status", () => {
  const sent = [];
  const response = {
    setHeader() {},
    status(code) {
      return { json: (body) => sent.push({ code, body }) };
    },
  };
  const host = {
    getType: () => "http",
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  };
  const filter = new HttpExceptionFilter();
  filter.catch(
    new ConflictException({
      message: "RECORDING_STATE_CONFLICT",
      status: "DECLINED",
      egressId: "EG_secret",
    }),
    host,
  );
  filter.catch(
    new ConflictException({
      message: "RECORDING_STATE_CONFLICT",
      status: "<script>",
    }),
    host,
  );
  assert.deepEqual(sent[0].body.details, { status: "DECLINED" });
  assert.equal(sent[1].body.details, undefined);
});
