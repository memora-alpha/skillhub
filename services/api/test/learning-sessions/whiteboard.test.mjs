import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import {
  finalizedOneWay,
  setup,
  A,
  B,
  C,
} from "../learning-platform/fixtures.mjs";
import { runner } from "../learning-platform/fake-db.mjs";
import { SessionWhiteboardService } from "../../dist/modules/learning-sessions/application/services/session-whiteboard.service.js";
import {
  checkWhiteboardScene,
  whiteboardAccess,
  WHITEBOARD_MAX_SCENE_BYTES,
} from "../../dist/modules/learning-sessions/domain/whiteboard.policy.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";

const participant = (userId) => ({
  userId,
  roles: ["USER"],
  permissions: [
    "session:read:participant",
    "session-whiteboard:update:participant",
  ],
});
const element = (id, version = 1) => ({
  id,
  type: "rectangle",
  version,
  versionNonce: version * 7,
  x: 0,
  y: 0,
});
const scene = (...ids) => ({
  elements: ids.map((id) => element(id)),
  appState: { viewBackgroundColor: "#ffffff" },
});

// Session fixture: 2026-11-02 10:00-11:00 UTC, join window 09:50-11:10,
// edit window closes 24 hours after endAt (2026-11-03 11:00). A teaches, B learns.
const editWindow = { teacherPrepare: true, afterEndMinutes: 1440 };
async function ready() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: {
      "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 },
      "whiteboard.editWindow": editWindow,
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
  return { ...ctx, ...ids, whiteboards };
}

test("empty board reads as revision 0 and editable inside the join window", async () => {
  const ctx = await ready();
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.deepEqual(board, {
    revision: 0,
    sceneData: null,
    updatedAt: null,
    updatedByUserId: null,
    readOnly: false,
    readOnlyReason: null,
    editableFrom: null,
    editableUntil: new Date("2026-11-03T11:00:00Z"),
  });
  const learner = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.deepEqual(learner.editableFrom, new Date("2026-11-02T09:50:00Z"));
});

test("saves advance the revision and both participants read the latest scene", async () => {
  const ctx = await ready();
  const first = await ctx.whiteboards.save(
    participant(A),
    ctx.session.id,
    0,
    scene("a"),
  );
  assert.equal(first.revision, 1);
  const second = await ctx.whiteboards.save(
    participant(B),
    ctx.session.id,
    1,
    scene("a", "b"),
  );
  assert.equal(second.revision, 2);
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.revision, 2);
  assert.equal(board.updatedByUserId, B);
  assert.deepEqual(
    board.sceneData.elements.map((e) => e.id),
    ["a", "b"],
  );
  // Element fields the server does not model are preserved for Excalidraw.
  assert.equal(board.sceneData.elements[0].x, 0);
  const row = ctx.db.rows("sessionWhiteboard");
  assert.equal(row.length, 1);
  assert.equal(
    row[0].sceneBytes,
    Buffer.byteLength(JSON.stringify(scene("a", "b"))),
  );
});

test("stale expectedRevision is rejected with the current revision", async () => {
  const ctx = await ready();
  await ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a"));
  await ctx.whiteboards.save(participant(B), ctx.session.id, 1, scene("b"));
  for (const stale of [0, 1, 5]) {
    await assert.rejects(
      () =>
        ctx.whiteboards.save(participant(A), ctx.session.id, stale, scene("c")),
      (error) => {
        assert.equal(error.getStatus(), 409);
        assert.deepEqual(error.getResponse(), {
          message: "WHITEBOARD_REVISION_CONFLICT",
          currentRevision: 2,
        });
        return true;
      },
    );
  }
  // A first save against a missing board must start from 0.
  const other = await ready();
  await assert.rejects(
    () =>
      other.whiteboards.save(participant(A), other.session.id, 3, scene("a")),
    { message: "WHITEBOARD_REVISION_CONFLICT" },
  );
});

test("a lost race on the first insert surfaces as a revision conflict", async () => {
  const ctx = await ready();
  await ctx.whiteboards.save(participant(B), ctx.session.id, 0, scene("b"));
  const service = new SessionWhiteboardService(
    ctx.db,
    {
      run: async () => {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      },
    },
    ctx.configuration,
    { now: () => ctx.clock.now },
  );
  await assert.rejects(
    () => service.save(participant(A), ctx.session.id, 0, scene("a")),
    (error) => {
      assert.deepEqual(error.getResponse(), {
        message: "WHITEBOARD_REVISION_CONFLICT",
        currentRevision: 1,
      });
      return true;
    },
  );
});

test("outsiders, missing permissions and unknown sessions are denied", async () => {
  const ctx = await ready();
  await assert.rejects(
    () => ctx.whiteboards.read(participant(C), ctx.session.id),
    { message: "SESSION_ACCESS_DENIED" },
  );
  await assert.rejects(
    () => ctx.whiteboards.save(participant(C), ctx.session.id, 0, scene("a")),
    { message: "SESSION_ACCESS_DENIED" },
  );
  const readOnlyGrant = {
    ...participant(A),
    permissions: ["session:read:participant"],
  };
  await ctx.whiteboards.read(readOnlyGrant, ctx.session.id);
  await assert.rejects(
    () => ctx.whiteboards.save(readOnlyGrant, ctx.session.id, 0, scene("a")),
    { message: "SESSION_ACCESS_DENIED" },
  );
  await assert.rejects(
    () =>
      ctx.whiteboards.read(
        { ...participant(A), permissions: [] },
        ctx.session.id,
      ),
    { message: "SESSION_ACCESS_DENIED" },
  );
  await assert.rejects(
    () =>
      ctx.whiteboards.read(
        participant(A),
        "00000000-0000-4000-8000-000000000000",
      ),
    { message: "SESSION_NOT_FOUND" },
  );
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 0);
});

test("board stays editable for the grace period, then freezes with its scene", async () => {
  const ctx = await ready();
  await ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a"));
  // After the join window closes, notes can still be finished.
  ctx.clock.now = new Date("2026-11-02T11:10:00Z");
  await ctx.whiteboards.save(
    participant(B),
    ctx.session.id,
    1,
    scene("a", "b"),
  );
  ctx.clock.now = new Date("2026-11-03T10:59:59Z");
  const open = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(open.readOnly, false);
  assert.deepEqual(open.editableUntil, new Date("2026-11-03T11:00:00Z"));
  ctx.clock.now = new Date("2026-11-03T11:00:00Z");
  const board = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(board.readOnly, true);
  assert.equal(board.readOnlyReason, "EDIT_WINDOW_CLOSED");
  assert.equal(board.revision, 2);
  assert.deepEqual(
    board.sceneData.elements.map((e) => e.id),
    ["a", "b"],
  );
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 2, scene("c")),
    (error) => {
      assert.equal(error.getStatus(), 409);
      assert.deepEqual(error.getResponse(), {
        message: "WHITEBOARD_READ_ONLY",
        reason: "EDIT_WINDOW_CLOSED",
      });
      return true;
    },
  );
});

test("teacher may prepare before the join window; learner may not", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2026-11-01T08:00:00Z");
  const learner = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(learner.readOnlyReason, "EDIT_WINDOW_NOT_OPEN");
  assert.deepEqual(learner.editableFrom, new Date("2026-11-02T09:50:00Z"));
  await assert.rejects(
    () => ctx.whiteboards.save(participant(B), ctx.session.id, 0, scene("a")),
    (error) => {
      assert.deepEqual(error.getResponse(), {
        message: "WHITEBOARD_READ_ONLY",
        reason: "EDIT_WINDOW_NOT_OPEN",
      });
      return true;
    },
  );
  const teacher = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(teacher.readOnly, false);
  assert.equal(teacher.editableFrom, null);
  const saved = await ctx.whiteboards.save(
    participant(A),
    ctx.session.id,
    0,
    scene("a"),
  );
  assert.equal(saved.revision, 1);
});

test("teacher preparation can be switched off", async () => {
  const ctx = await ready();
  ctx.configuration.values["whiteboard.editWindow"] = {
    teacherPrepare: false,
    afterEndMinutes: 0,
  };
  ctx.clock.now = new Date("2026-11-02T09:49:59Z");
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a")),
    { message: "WHITEBOARD_READ_ONLY" },
  );
  // With no grace period the join window close still applies.
  ctx.clock.now = new Date("2026-11-02T11:09:59Z");
  await ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a"));
  ctx.clock.now = new Date("2026-11-02T11:10:00Z");
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnlyReason, "EDIT_WINDOW_CLOSED");
});

for (const status of ["CANCELLED", "DISPUTED", "NO_SHOW", "MAKEUP_REQUIRED"]) {
  test("board is frozen for a " + status + " Session", async () => {
    const ctx = await ready();
    await ctx.db.session.update({
      where: { id: ctx.session.id },
      data: { status },
    });
    const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
    assert.equal(board.readOnlyReason, "SESSION_NOT_EDITABLE");
    assert.equal(board.editableUntil, null);
    await assert.rejects(
      () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a")),
      { message: "WHITEBOARD_READ_ONLY" },
    );
  });
}

test("a COMPLETED Session stays editable during the grace period", async () => {
  const ctx = await ready();
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { status: "COMPLETED" },
  });
  ctx.clock.now = new Date("2026-11-02T15:00:00Z");
  const saved = await ctx.whiteboards.save(
    participant(B),
    ctx.session.id,
    0,
    scene("a"),
  );
  assert.equal(saved.revision, 1);
});

test("missing configuration blocks saves but keeps reads available", async () => {
  const ctx = await ready();
  delete ctx.configuration.values["whiteboard.editWindow"];
  const partial = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(partial.readOnlyReason, "WHITEBOARD_POLICY_NOT_READY");
  ctx.configuration.getSnapshot = async () => {
    throw new ServiceUnavailableException("Configuration not ready");
  };
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnly, true);
  assert.equal(board.readOnlyReason, "WHITEBOARD_POLICY_NOT_READY");
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a")),
    { message: "WHITEBOARD_POLICY_NOT_READY" },
  );
});

test("invalid and oversized scenes are rejected before any write", async () => {
  const ctx = await ready();
  for (const bad of [
    [],
    { elements: "x" },
    { elements: [{ id: "a" }] },
    { elements: [element("a"), element("a")] },
    { elements: [], extra: true },
    { elements: [element("a")], appState: [] },
  ]) {
    await assert.rejects(
      () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, bad),
      { message: "INVALID_WHITEBOARD_SCENE" },
    );
  }
  const huge = {
    elements: [
      { ...element("a"), text: "x".repeat(WHITEBOARD_MAX_SCENE_BYTES) },
    ],
  };
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, huge),
    (error) => {
      assert.equal(error.getStatus(), 413);
      assert.equal(error.message, "WHITEBOARD_SCENE_TOO_LARGE");
      return true;
    },
  );
  assert.equal(ctx.db.rows("sessionWhiteboard").length, 0);
});

test("scene check measures UTF-8 bytes and accepts the exact limit", () => {
  const base = { elements: [{ ...element("a"), text: "" }] };
  const overhead = Buffer.byteLength(JSON.stringify(base));
  const fits = {
    elements: [
      {
        ...element("a"),
        text: "x".repeat(WHITEBOARD_MAX_SCENE_BYTES - overhead),
      },
    ],
  };
  const check = checkWhiteboardScene(fits);
  assert.equal(check.ok, true);
  assert.equal(check.bytes, WHITEBOARD_MAX_SCENE_BYTES);
  // Multi-byte text counts by bytes, not characters.
  const wide = {
    elements: [
      { ...element("a"), text: "ệ".repeat(WHITEBOARD_MAX_SCENE_BYTES / 2) },
    ],
  };
  assert.deepEqual(checkWhiteboardScene(wide), {
    ok: false,
    code: "WHITEBOARD_SCENE_TOO_LARGE",
  });
});

test("access boundaries per role", () => {
  const session = {
    status: "CONFIRMED",
    startAt: new Date("2026-11-02T10:00:00Z"),
    endAt: new Date("2026-11-02T11:00:00Z"),
  };
  const join = { earlyMinutes: 10, lateMinutes: 10 };
  const at = (role, iso, edit = editWindow) =>
    whiteboardAccess(session, role, new Date(iso), join, edit);
  assert.equal(at("LEARNER", "2026-11-02T09:49:59Z").readOnly, true);
  assert.equal(at("LEARNER", "2026-11-02T09:50:00Z").readOnly, false);
  assert.equal(at("TEACHER", "2026-10-01T00:00:00Z").readOnly, false);
  assert.equal(at("LEARNER", "2026-11-03T10:59:59Z").readOnly, false);
  assert.deepEqual(at("TEACHER", "2026-11-03T11:00:00Z"), {
    readOnly: true,
    readOnlyReason: "EDIT_WINDOW_CLOSED",
    editableFrom: null,
    editableUntil: new Date("2026-11-03T11:00:00Z"),
  });
  // A grace period shorter than the join window never cuts the room short.
  const short = { teacherPrepare: false, afterEndMinutes: 5 };
  assert.equal(at("TEACHER", "2026-11-02T11:09:59Z", short).readOnly, false);
  assert.equal(at("TEACHER", "2026-11-02T11:10:00Z", short).readOnly, true);
  assert.deepEqual(
    whiteboardAccess(
      session,
      "TEACHER",
      new Date("2026-11-02T10:30:00Z"),
      null,
      editWindow,
    ),
    {
      readOnly: true,
      readOnlyReason: "WHITEBOARD_POLICY_NOT_READY",
      editableFrom: null,
      editableUntil: null,
    },
  );
});

test("error filter exposes only whitelisted whiteboard details", () => {
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
      message: "WHITEBOARD_REVISION_CONFLICT",
      currentRevision: 4,
      sceneData: { secret: true },
    }),
    host,
  );
  filter.catch(
    new ConflictException({
      message: "WHITEBOARD_READ_ONLY",
      reason: "EDIT_WINDOW_CLOSED",
    }),
    host,
  );
  filter.catch(
    new ConflictException({
      message: "WHITEBOARD_READ_ONLY",
      reason: "<script>",
    }),
    host,
  );
  filter.catch(
    new ConflictException({
      message: "WHITEBOARD_READ_ONLY",
      reason: "SESSION_UNDER_REPORT",
    }),
    host,
  );
  assert.deepEqual(sent[0].body.details, { currentRevision: 4 });
  assert.deepEqual(sent[1].body.details, { reason: "EDIT_WINDOW_CLOSED" });
  assert.equal(sent[2].body.details, undefined);
  assert.deepEqual(sent[3].body.details, { reason: "SESSION_UNDER_REPORT" });
  assert.ok(sent.every(({ code }) => code === 409));
});
