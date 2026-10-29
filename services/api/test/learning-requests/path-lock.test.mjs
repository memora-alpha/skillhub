import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LearningRequestPathReader } from "../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { CancelLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.js";
import { createFakeDb } from "../learning-platform/fake-db.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const teacher = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";
const pathId = "55555555-5555-4555-8555-555555555555";
const conflict = (code) => (error) =>
  error.getStatus?.() === 409 && error.message === code;

function setup() {
  const db = createFakeDb();
  db.seed("learningRequest", {
    id: requestId,
    ownerId: owner,
    status: "NEGOTIATING",
    version: 2,
    preferredSlots: [],
    tagLinks: [],
  });
  db.seed("proposal", {
    id: "proposal",
    requestId,
    status: "ACCEPTED",
    sourceType: "LEARNING_REQUEST",
    proposerId: teacher,
    recipientId: owner,
  });
  db.seed("conversation", {
    id: conversationId,
    requestId,
    proposalId: "proposal",
    participantAId: teacher,
    participantBId: owner,
  });
  db.seed("learningPath", {
    id: pathId,
    conversationId,
    participantAId: teacher,
    participantBId: owner,
    status: "CONFIRMED",
    currentVersion: 1,
  });
  const reader = new LearningRequestPathReader();
  const row = db.rows("learningRequest")[0];
  const cancel = new CancelLearningRequestUseCase(
    { run: (work) => work(db) },
    { assertUserAction: async (_tx, actor) => actor },
    {
      lock: async () => row,
      databaseNow: async () => new Date(),
      transition: async (_tx, _id, version, statuses, update) => {
        if (row.version !== version || !statuses.includes(row.status))
          return false;
        Object.assign(row, update, { version: version + 1 });
        return true;
      },
    },
    reader,
  );
  return {
    db,
    reader,
    row,
    cancel: (userId = owner, expectedVersion = 2) =>
      cancel.execute({ userId }, requestId, { expectedVersion }),
  };
}

test("cancel permits confirmed but unlocked path and retains history", async () => {
  const ctx = setup();
  assert.equal((await ctx.cancel()).status, "CANCELLED");
  assert.equal(ctx.row.version, 3);
  assert.equal(ctx.db.rows("learningPath")[0].status, "CONFIRMED");
  assert.equal(ctx.db.rows("conversation").length, 1);
  assert.equal(ctx.db.rows("proposal")[0].status, "ACCEPTED");
});

test("cancel refuses lock evidence even after path status regression", async () => {
  for (const evidence of [
    "lockedVersion",
    "schedule",
    "appliedSchedule",
    "session",
    "settledAt",
    "hold",
  ]) {
    const ctx = setup();
    if (evidence === "lockedVersion")
      ctx.db.rows("learningPath")[0].lockedVersion = 1;
    if (evidence === "settledAt")
      ctx.db.rows("learningPath")[0].settledAt = new Date();
    if (evidence === "schedule")
      ctx.db.seed("scheduleProposal", {
        id: "schedule",
        pathId,
        status: "LOCKED",
      });
    if (evidence === "appliedSchedule")
      ctx.db.seed("scheduleProposal", {
        id: "schedule",
        pathId,
        status: "NEEDS_REVISION",
        appliedVersion: 1,
      });
    if (evidence === "session")
      ctx.db.seed("session", { id: "session", pathId });
    if (evidence === "hold")
      ctx.db.seed("heldCreditAllocation", { id: "hold", pathId });
    await assert.rejects(ctx.cancel(), conflict("REQUEST_LOCKED"), evidence);
    assert.equal(ctx.row.status, "NEGOTIATING");
    assert.equal(ctx.row.version, 2);
  }
});

test("source mismatch and missing negotiation source fail closed", async () => {
  const ctx = setup();
  ctx.db.rows("proposal")[0].requestId = null;
  await assert.rejects(
    ctx.reader.readPathSource(ctx.db, pathId),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
  await assert.rejects(
    ctx.cancel(),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
  for (const table of ["conversation", "proposal"]) {
    const missing = setup();
    missing.db.rows(table).length = 0;
    await assert.rejects(
      missing.cancel(),
      conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
    );
  }
});

test("direct exchange requires both request IDs null and accepted participants", async () => {
  const ctx = setup();
  ctx.db.rows("conversation")[0].requestId = null;
  Object.assign(ctx.db.rows("proposal")[0], {
    requestId: null,
    sourceType: "DIRECT_SEARCH",
  });
  assert.equal(
    (await ctx.reader.readPathSource(ctx.db, pathId)).requestId,
    null,
  );
  ctx.db.rows("proposal")[0].recipientId = teacher;
  await assert.rejects(
    ctx.reader.readPathSource(ctx.db, pathId),
    conflict("REQUEST_LIFECYCLE_INCONSISTENT"),
  );
});

test("cancel preserves owner and version checks and gives business error after match", async () => {
  const ctx = setup();
  await assert.rejects(
    ctx.cancel(teacher),
    (error) => error.getStatus?.() === 404,
  );
  await assert.rejects(
    ctx.cancel(owner, 1),
    conflict("REQUEST_VERSION_CONFLICT"),
  );
  ctx.row.status = "MATCHED";
  await assert.rejects(ctx.cancel(), conflict("REQUEST_LOCKED"));
});
