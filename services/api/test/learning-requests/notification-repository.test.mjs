import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaNotificationRepository } from "../../dist/modules/notifications/infrastructure/persistence/prisma-notification.repository.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-10-06T00:00:00.000Z");

test("notification repository always scopes inbox queries to the recipient and cursor", async () => {
  let query;
  const notification = { findMany: async (input) => ((query = input), []) };
  const repository = new PrismaNotificationRepository({ notification });
  await repository.listMine(
    { notification },
    ownerId,
    { createdAt, id: notificationId },
    21,
  );
  assert.equal(query.where.userId, ownerId);
  assert.deepEqual(query.where.OR, [
    { createdAt: { lt: createdAt } },
    { createdAt, id: { lt: notificationId } },
  ]);
  assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(query.take, 21);
});

test("notification repository returns no record when the ID belongs to another recipient", async () => {
  const queries = [];
  const tx = {
    notification: {
      findFirst: async (query) => {
        queries.push(query);
        return null;
      },
      updateMany: async () => ({ count: 0 }),
    },
  };
  const repository = new PrismaNotificationRepository({
    notification: tx.notification,
  });
  assert.equal(await repository.markRead(tx, ownerId, notificationId), null);
  assert.deepEqual(queries, [
    { where: { id: notificationId, userId: ownerId } },
  ]);
});
