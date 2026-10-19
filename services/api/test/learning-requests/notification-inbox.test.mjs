import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
} from "../../dist/modules/notifications/application/use-cases/notification-inbox.use-cases.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const firstId = "33333333-3333-4333-8333-333333333333";
const secondId = "44444444-4444-4444-8444-444444444444";
const firstDate = new Date("2026-10-06T00:00:00.000Z");
const secondDate = new Date("2026-10-05T00:00:00.000Z");

const actor = {
  userId: ownerId,
  sessionId: "55555555-5555-4555-8555-555555555555",
  securityVersion: 1,
  roles: ["USER"],
  permissions: ["notification:read:self", "notification:update:self"],
};

function notification(id, createdAt, userId = ownerId) {
  return {
    id,
    userId,
    type: "LEARNING_REQUEST_REJECTED",
    title: "Learning request update",
    body: "Your learning request was rejected.",
    payload: { requestId: otherId, reviewedVersion: 2 },
    channel: "IN_APP",
    readAt: null,
    createdAt,
  };
}

function harness() {
  const calls = { permissions: [], list: [], marked: [] };
  const tx = { $queryRaw: async () => [] };
  const transactions = { run: (work) => work(tx) };
  const access = {
    assertAction: async (_tx, principal, permission) => {
      calls.permissions.push(permission);
      if (!principal.permissions.includes(permission))
        throw Object.assign(new Error(), { status: 403 });
      return principal;
    },
  };
  const repository = {
    listMine: async (_tx, userId, cursor, take) => {
      calls.list.push({ userId, cursor, take });
      const rows = [
        notification(firstId, firstDate, userId),
        notification(secondId, secondDate, userId),
      ].filter(
        (item) =>
          !cursor ||
          item.createdAt < cursor.createdAt ||
          (item.createdAt.getTime() === cursor.createdAt.getTime() &&
            item.id < cursor.id),
      );
      return rows.slice(0, take);
    },
    markRead: async (_tx, userId, notificationId) => {
      calls.marked.push({ userId, notificationId });
      if (userId !== ownerId || notificationId !== firstId) return null;
      return { ...notification(firstId, firstDate), readAt: firstDate };
    },
  };
  return {
    calls,
    list: new ListNotificationsUseCase(transactions, access, repository),
    mark: new MarkNotificationReadUseCase(transactions, access, repository),
  };
}

test("inbox pages only the authenticated recipient and emits a stable seek cursor", async () => {
  const { calls, list } = harness();
  const firstPage = await list.execute(actor, { limit: 1 });
  assert.equal(firstPage.items.length, 1);
  assert.equal(firstPage.items[0].id, firstId);
  assert.equal("userId" in firstPage.items[0], false);
  assert.ok(firstPage.nextCursor);
  const secondPage = await list.execute(actor, {
    limit: 1,
    cursor: firstPage.nextCursor,
  });
  assert.equal(secondPage.items[0].id, secondId);
  assert.equal(calls.list[0].userId, ownerId);
  assert.equal(calls.list[0].take, 2);
  assert.deepEqual(calls.list[1].cursor, { createdAt: firstDate, id: firstId });
  assert.deepEqual(calls.permissions, [
    "notification:read:self",
    "notification:read:self",
  ]);
});

test("mark-read is scoped to the recipient and an outsider gets the same 404 as a missing id", async () => {
  const { calls, mark } = harness();
  const read = await mark.execute(actor, firstId);
  assert.equal(read.readAt.toISOString(), firstDate.toISOString());
  assert.deepEqual(calls.marked[0], {
    userId: ownerId,
    notificationId: firstId,
  });
  await assert.rejects(
    () => mark.execute(actor, secondId),
    (error) => error.getStatus?.() === 404,
  );
  assert.deepEqual(calls.marked[1], {
    userId: ownerId,
    notificationId: secondId,
  });
});

test("inbox rejects malformed cursor and invalid limits", async () => {
  const { list, calls } = harness();
  await assert.rejects(() => list.execute(actor, { cursor: "bad" }));
  await assert.rejects(() => list.execute(actor, { limit: 101 }));
  assert.equal(calls.list.length, 0);
});
