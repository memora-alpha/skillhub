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

// Session fixture: 2026-11-02 10:00-11:00 UTC, join window 09:50-11:10.
async function ready() {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: { "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 } },
  });
  const ids = await finalizedOneWay(ctx);
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  const whiteboards = new SessionWhiteboardService(
    ctx.db,
    runner(ctx.db),
    ctx.configuration,
    { now: () => ctx.clock.now },
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
  });
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

test("board becomes read-only after the join window and keeps its scene", async () => {
  const ctx = await ready();
  await ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a"));
  ctx.clock.now = new Date("2026-11-02T11:10:00Z");
  const board = await ctx.whiteboards.read(participant(B), ctx.session.id);
  assert.equal(board.readOnly, true);
  assert.equal(board.readOnlyReason, "JOIN_WINDOW_CLOSED");
  assert.equal(board.revision, 1);
  assert.deepEqual(
    board.sceneData.elements.map((e) => e.id),
    ["a"],
  );
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 1, scene("b")),
    (error) => {
      assert.equal(error.getStatus(), 409);
      assert.deepEqual(error.getResponse(), {
        message: "WHITEBOARD_READ_ONLY",
        reason: "JOIN_WINDOW_CLOSED",
      });
      return true;
    },
  );
});

test("board is read-only before the window and for non-joinable statuses", async () => {
  const ctx = await ready();
  ctx.clock.now = new Date("2026-11-02T09:49:59Z");
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a")),
    { message: "WHITEBOARD_READ_ONLY" },
  );
  ctx.clock.now = new Date("2026-11-02T10:05:00Z");
  await ctx.db.session.update({
    where: { id: ctx.session.id },
    data: { status: "CANCELLED" },
  });
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnlyReason, "SESSION_NOT_JOINABLE");
});

test("missing join policy blocks saves but keeps reads available", async () => {
  const ctx = await ready();
  ctx.configuration.getSnapshot = async () => {
    throw new ServiceUnavailableException("Configuration not ready");
  };
  const board = await ctx.whiteboards.read(participant(A), ctx.session.id);
  assert.equal(board.readOnly, true);
  assert.equal(board.readOnlyReason, "LIVEKIT_POLICY_NOT_READY");
  await assert.rejects(
    () => ctx.whiteboards.save(participant(A), ctx.session.id, 0, scene("a")),
    { message: "LIVEKIT_POLICY_NOT_READY" },
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

test("access mirrors the join window boundaries", () => {
  const session = {
    status: "ONGOING",
    startAt: new Date("2026-11-02T10:00:00Z"),
    endAt: new Date("2026-11-02T11:00:00Z"),
  };
  const policy = { earlyMinutes: 10, lateMinutes: 10 };
  const at = (iso) => whiteboardAccess(session, new Date(iso), policy);
  assert.equal(at("2026-11-02T09:50:00Z").readOnly, false);
  assert.equal(at("2026-11-02T11:09:59Z").readOnly, false);
  assert.deepEqual(at("2026-11-02T11:10:00Z"), {
    readOnly: true,
    readOnlyReason: "JOIN_WINDOW_CLOSED",
  });
  assert.deepEqual(
    whiteboardAccess(session, new Date("2026-11-02T10:30:00Z"), null),
    { readOnly: true, readOnlyReason: "LIVEKIT_POLICY_NOT_READY" },
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
      reason: "JOIN_WINDOW_CLOSED",
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
  assert.deepEqual(sent[0].body.details, { currentRevision: 4 });
  assert.deepEqual(sent[1].body.details, { reason: "JOIN_WINDOW_CLOSED" });
  assert.equal(sent[2].body.details, undefined);
  assert.ok(sent.every(({ code }) => code === 409));
});
