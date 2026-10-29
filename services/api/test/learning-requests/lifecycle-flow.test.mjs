import assert from "node:assert/strict";
import { test } from "node:test";
import {
  A,
  B,
  conversationId,
  setup,
  scheduledOneWay,
  scheduledTwoWay,
  completedOneWay,
  finalizeAs,
  user,
} from "../learning-platform/fixtures.mjs";

const requestId = "d0d0d0d0-0000-4000-8000-0000000000d0";
const row = (ctx) => ctx.db.rows("learningRequest")[0];
const conflict = (code) => (error) =>
  error.getStatus?.() === 409 && error.message === code;

test("finalize atomically marks the source request MATCHED once for ONE_WAY and TWO_WAY", async () => {
  for (const schedule of [scheduledOneWay, scheduledTwoWay]) {
    const ctx = setup({ requestId, wallets: { [A]: 20000n, [B]: 20000n } });
    const { pathId } = await schedule(ctx);
    assert.equal(row(ctx).status, "NEGOTIATING");
    await finalizeAs(ctx, A, pathId, "first");
    assert.equal(row(ctx).status, "MATCHED");
    assert.equal(row(ctx).version, 3);
    const count = ctx.db.rows("session").length;
    await finalizeAs(ctx, A, pathId, "first");
    await finalizeAs(ctx, B, pathId, "other-key");
    assert.equal(row(ctx).version, 3);
    assert.equal(ctx.db.rows("session").length, count);
    assert.equal(ctx.db.rows("creditOperation").length, 1);
  }
});

test("cancelled request cannot create or finalize a new commitment", async () => {
  const ctx = setup({ requestId, wallets: { [B]: 20000n } });
  const { pathId } = await scheduledOneWay(ctx);
  row(ctx).status = "CANCELLED";
  await assert.rejects(
    ctx.paths.create(user(B), {
      conversationId,
      exchangeType: "ONE_WAY",
      teacherId: A,
      learnerId: B,
      negotiatedCredit: "100.00",
    }),
    conflict("REQUEST_NOT_AVAILABLE"),
  );
  await assert.rejects(
    finalizeAs(ctx, A, pathId),
    conflict("REQUEST_NOT_AVAILABLE"),
  );
  assert.equal(ctx.db.rows("creditOperation").length, 0);
  assert.equal(ctx.db.rows("session").length, 0);
});

test("only one draft can finalize and the losing draft remains intact", async () => {
  const ctx = setup({ requestId, wallets: { [B]: 20000n } });
  const first = await scheduledOneWay(ctx);
  const other = await scheduledOneWay(ctx);
  await finalizeAs(ctx, A, first.pathId);
  await assert.rejects(
    finalizeAs(ctx, B, other.pathId, "other-path"),
    conflict("REQUEST_ALREADY_MATCHED"),
  );
  assert.equal(ctx.db.rows("creditOperation").length, 1);
  assert.equal(
    ctx.db.rows("learningPath").find((p) => p.id === other.pathId)
      .lockedVersion,
    null,
  );
  assert.equal(ctx.db.rows("learningPath").length, 2);
});

test("direct finalize touches no Request and source mismatch is not treated as direct", async () => {
  const direct = setup({ wallets: { [B]: 20000n } });
  const { pathId } = await scheduledOneWay(direct);
  await finalizeAs(direct, A, pathId);
  assert.equal(direct.db.rows("learningRequest").length, 0);
  const mismatch = setup({ requestId, wallets: { [B]: 20000n } });
  const draft = await scheduledOneWay(mismatch);
  mismatch.db.rows("proposal")[0].requestId = null;
  await assert.rejects(
    finalizeAs(mismatch, A, draft.pathId),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
});

test("successful full settlement closes only the source request once, including worker replay", async () => {
  const ctx = setup({ requestId, wallets: { [B]: 10000n } });
  const { pathId } = await completedOneWay(ctx);
  ctx.db.seed("learningRequest", {
    id: "unrelated",
    ownerId: A,
    status: "MATCHED",
    version: 7,
  });
  assert.equal(row(ctx).status, "MATCHED");
  await assert.rejects(
    ctx.sessions.settlePath(user(B), pathId),
    conflict("DISPUTE_WINDOW_OPEN"),
  );
  assert.equal(row(ctx).status, "MATCHED");
  ctx.clock.now = new Date("2026-11-05T00:00:00Z");
  assert.equal(
    (await ctx.sessions.trySettleCompletedPath(pathId)).outcome,
    "SETTLED",
  );
  assert.equal(row(ctx).status, "CLOSED");
  assert.equal(row(ctx).version, 4);
  const operations = ctx.db.rows("creditOperation").length;
  await ctx.sessions.settlePath(user(A), pathId);
  await ctx.sessions.trySettleCompletedPath(pathId);
  assert.equal(row(ctx).version, 4);
  assert.equal(ctx.db.rows("creditOperation").length, operations);
  assert.equal(ctx.db.rows("learningRequest")[1].version, 7);
});

test("TWO_WAY cannot close after only one plan and closes after both plans settle", async () => {
  const ctx = setup({ requestId, wallets: { [A]: 20000n, [B]: 20000n } });
  const { pathId } = await scheduledTwoWay(ctx);
  await finalizeAs(ctx, A, pathId);
  ctx.clock.now = new Date("2026-11-06T00:00:00Z");
  const [first, second] = ctx.db.rows("session");
  await ctx.sessions.complete(user(A), first.id, "done");
  await ctx.sessions.complete(user(B), first.id, "done");
  await assert.rejects(
    ctx.sessions.settlePath(user(A), pathId),
    conflict("LEARNING_PATH_NOT_SETTLEABLE"),
  );
  assert.equal(row(ctx).status, "MATCHED");
  await ctx.sessions.complete(user(A), second.id, "done");
  await ctx.sessions.complete(user(B), second.id, "done");
  await ctx.sessions.settlePath(user(B), pathId);
  assert.equal(row(ctx).status, "CLOSED");
});

test("settlement never silently repairs a cancelled or mismatched legacy Request", async () => {
  for (const status of ["CANCELLED", "NEGOTIATING"]) {
    const ctx = setup({ requestId, wallets: { [B]: 10000n } });
    const { pathId } = await completedOneWay(ctx);
    ctx.clock.now = new Date("2026-11-05T00:00:00Z");
    row(ctx).status = status;
    await assert.rejects(
      ctx.sessions.settlePath(user(B), pathId),
      conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
    );
    assert.equal(ctx.db.rows("creditOperation").length, 1);
    assert.equal(row(ctx).status, status);
  }
});

test("finalize revalidates the entire source identity after acquiring lifecycle locks", async () => {
  const ctx = setup({ requestId, wallets: { [B]: 10000n } });
  const { pathId } = await scheduledOneWay(ctx);
  const read = ctx.requestPaths.readPathSource.bind(ctx.requestPaths);
  let reads = 0;
  ctx.requestPaths.readPathSource = async (...args) => {
    const source = await read(...args);
    return ++reads === 1
      ? source
      : { ...source, proposalId: "different-proposal" };
  };
  await assert.rejects(
    finalizeAs(ctx, A, pathId),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
  assert.equal(ctx.db.rows("creditOperation").length, 0);
});

test("create and settlement also reject a source identity changed during locking", async () => {
  const ctx = setup({ requestId, wallets: { [B]: 10000n } });
  const read = ctx.requestPaths.readConversationSource.bind(ctx.requestPaths);
  let reads = 0;
  ctx.requestPaths.readConversationSource = async (...args) => {
    const source = await read(...args);
    return ++reads === 1 ? source : { ...source, proposalId: "different" };
  };
  await assert.rejects(
    ctx.paths.create(user(B), {
      conversationId,
      exchangeType: "ONE_WAY",
      teacherId: A,
      learnerId: B,
      negotiatedCredit: "100.00",
    }),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
  const other = setup({ requestId, wallets: { [B]: 10000n } });
  const { pathId } = await completedOneWay(other);
  other.clock.now = new Date("2026-11-05T00:00:00Z");
  const readPath = other.requestPaths.readPathSource.bind(other.requestPaths);
  reads = 0;
  other.requestPaths.readPathSource = async (...args) => {
    const source = await readPath(...args);
    return ++reads === 1 ? source : { ...source, proposalId: "different" };
  };
  await assert.rejects(
    other.sessions.settlePath(user(B), pathId),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
});
