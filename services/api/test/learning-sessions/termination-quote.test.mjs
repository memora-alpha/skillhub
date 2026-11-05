import assert from "node:assert/strict";
import { test } from "node:test";
import { PathTerminationService } from "../../dist/modules/learning-paths/application/services/path-termination.service.js";
import { readTerminationQuote } from "../../dist/modules/credit/application/services/termination-quote.reader.js";
import { LearningChangeState } from "../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { SessionChangesService } from "../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { runner } from "../learning-platform/fake-db.mjs";
import {
  setup,
  scheduledTwoWay,
  finalizedOneWay,
  finalizeAs,
  A,
  B,
  C,
  user,
} from "../learning-platform/fixtures.mjs";

async function fixture(twoWay = true, locked = true) {
  const ctx = setup({ wallets: { [A]: 10000n, [B]: 10000n } });
  const ids = twoWay
    ? await scheduledTwoWay(ctx, "100.00")
    : await finalizedOneWay(ctx);
  if (twoWay && locked) await finalizeAs(ctx, A, ids.pathId);
  const state = new LearningChangeState({}, ctx.configuration);
  const stop = new PathTerminationService(
    runner(ctx.db),
    state,
    new SessionChangesService(runner(ctx.db), state),
    { previewHeld: readTerminationQuote },
    ctx.requests,
    ctx.requestPaths,
  );
  return { ...ctx, ...ids, stop };
}

test("participant quote returns immutable shares, direction progress and policy blockers without moving Credit", async () => {
  const ctx = await fixture();
  const before = structuredClone(ctx.db.rows("creditWallet"));
  const initial = await ctx.stop.quote(user(A), ctx.pathId);
  assert.deepEqual(initial.reasonCodes, ["TERMINATION_POLICY_NOT_APPROVED"]);
  assert.equal(initial.totalSessions, 2);
  assert.equal(initial.allocations[0].refund, "96.00");
  assert.equal(initial.allocations[0].sessionCredits.length, 2);
  ctx.configuration.values[
    "learningPath.changeRequests"
  ].terminationPolicyReference = "approved-v1";
  ctx.db.rows("session")[0].status = "COMPLETED";
  const quote = await ctx.stop.quote(user(B), ctx.pathId);
  quote.allocations.sort(
    (a, b) =>
      Number(b.userId === ctx.db.rows("session")[0].teacherId) -
      Number(a.userId === ctx.db.rows("session")[0].teacherId),
  );
  assert.equal(quote.status, "READY");
  assert.equal(quote.allocations[0].completedCredit, "100.00");
  assert.equal(quote.allocations[0].refund, "96.00");
  assert.equal(quote.allocations[0].platformFee, "4.00");
  assert.equal(quote.allocations[0].counterpartyPayment, "0.00");
  assert.notEqual(quote.executionDigest, initial.executionDigest);
  assert.deepEqual(ctx.db.rows("creditWallet"), before);
  await assert.rejects(
    () => ctx.stop.quote(user(C), ctx.pathId),
    /LEARNING_PATH_ACCESS_DENIED/,
  );
});

test("unruled sessions, expired makeup and blocking reports prevent execution", async () => {
  const ctx = await fixture();
  const row = ctx.db.rows("session")[0];
  row.status = "AWAITING_CONFIRMATION";
  assert.ok(
    (await ctx.stop.quote(user(A), ctx.pathId)).reasonCodes.includes(
      "TERMINATION_SESSION_RULING_REQUIRED",
    ),
  );
  row.status = "MAKEUP_REQUIRED";
  row.makeupDeadlineAt = new Date(+ctx.clock.now - 1);
  assert.ok(
    (await ctx.stop.quote(user(A), ctx.pathId)).reasonCodes.includes(
      "TERMINATION_SESSION_RULING_REQUIRED",
    ),
  );
  row.makeupDeadlineAt = new Date(+ctx.clock.now + 1000);
  ctx.db.seed("reportCase", {
    relatedPathId: ctx.pathId,
    blocksSettlement: true,
    status: "OPEN",
  });
  assert.ok(
    (await ctx.stop.quote(user(A), ctx.pathId)).reasonCodes.includes(
      "TERMINATION_BLOCKED_BY_DISPUTE",
    ),
  );
});

test("legacy snapshots stay blocked and completed paths use ordinary final settlement", async () => {
  const ctx = await fixture();
  ctx.db.rows("heldCreditAllocation")[0].sessionCreditSnapshot = null;
  assert.ok(
    (await ctx.stop.quote(user(A), ctx.pathId)).reasonCodes.includes(
      "SESSION_CREDIT_SNAPSHOT_MISSING",
    ),
  );
  for (const row of ctx.db.rows("session")) row.status = "COMPLETED";
  assert.ok(
    (await ctx.stop.quote(user(A), ctx.pathId)).reasonCodes.includes(
      "TERMINATION_USE_FINAL_SETTLEMENT",
    ),
  );
});

test("ONE_WAY future cancellation returns full Held to learner and never requires a teacher Hold", async () => {
  const ctx = await fixture(false);
  const quote = await ctx.stop.quote(user(B), ctx.pathId);
  assert.equal(quote.allocations.length, 1);
  assert.equal(quote.allocations[0].userId, B);
  assert.equal(quote.allocations[0].refund, "100.00");
  assert.equal(quote.allocations[0].counterpartyPayment, "0.00");
});

test("before Hold the quote has no refund, payment or fee and creates no ledger entry", async () => {
  const ctx = await fixture(true, false);
  const quote = await ctx.stop.quote(user(A), ctx.pathId);
  assert.equal(quote.status, "NOT_LOCKED");
  assert.equal(quote.executionDigest, null);
  assert.deepEqual(quote.allocations, []);
  assert.deepEqual(quote.reasonCodes, ["CREDIT_NOT_HELD"]);
  assert.equal(ctx.db.rows("creditOperation").length, 0);
});
