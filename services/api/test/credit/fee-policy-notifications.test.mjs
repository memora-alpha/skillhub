import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { FeePolicyNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/fee-policy-notification.handler.js";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup(userIds = []) {
  const types = [];
  const sent = [];
  const ordered = [...userIds].sort();
  const handler = new FeePolicyNotificationHandler(
    { register: (type) => types.push(type) },
    { dispatch: async (message) => sent.push(message) },
    {
      user: {
        findMany: async ({ where, take }) =>
          ordered
            .filter((id) => !where.id?.gt || id > where.id.gt)
            .slice(0, take)
            .map((id) => ({ id })),
      },
    },
  );
  handler.onModuleInit();
  return { handler, sent, types };
}

function event(type, overrides = {}, eventId = randomUUID()) {
  return {
    eventId,
    type,
    version: 2,
    correlationId: randomUUID(),
    payload: {
      policyId: randomUUID(),
      policyCode: "TWO_WAY",
      versionNo: 2,
      previousFeeBps: 400,
      feeBps: 550,
      effectiveAt: "2026-12-01T00:00:00.000Z",
      ...overrides,
    },
  };
}

test("registers approval and effective fee-policy events", () => {
  assert.deepEqual(setup().types, [
    "admin.fee-policy.approved",
    "credit.fee-policy.effective",
  ]);
});

test("approval immediately confirms the decision to the approving Admin", async () => {
  const { handler, sent } = setup();
  const approvedByUserId = randomUUID();
  await handler.publish(
    event("admin.fee-policy.approved", { approvedByUserId }),
  );
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].userIds, [approvedByUserId]);
  assert.equal(sent[0].title, "Đã duyệt chính sách phí");
  assert.match(sent[0].body, /4% thành 5,5%/);
});

test("effective policy notifies active users in stable retry-safe batches", async () => {
  const users = Array.from({ length: 501 }, () => randomUUID());
  const { handler, sent } = setup(users);
  const eventId = randomUUID();
  const message = event("credit.fee-policy.effective", {}, eventId);
  await handler.publish(message);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].userIds.length, 500);
  assert.equal(sent[1].userIds.length, 1);
  assert.match(sent[0].eventId, UUID);
  assert.match(sent[0].body, /khóa sau thời điểm này/);
  const firstIds = sent.map(({ eventId: id }) => id);
  await handler.publish(message);
  assert.deepEqual(
    sent.slice(2).map(({ eventId: id }) => id),
    firstIds,
  );
});

test("rejects malformed fee-policy events before dispatch", async () => {
  const { handler, sent } = setup([randomUUID()]);
  for (const bad of [
    event("credit.fee-policy.effective", { feeBps: 10000 }),
    event("credit.fee-policy.effective", { policyCode: "UNKNOWN" }),
    event("credit.fee-policy.effective", { effectiveAt: "tomorrow" }),
    event("admin.fee-policy.approved"),
  ])
    await assert.rejects(handler.publish(bad), /INVALID_FEE_POLICY_EVENT/);
  assert.equal(sent.length, 0);
});
