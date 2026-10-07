import assert from "node:assert/strict";
import { test } from "node:test";
import { OutboxConsumer } from "../../dist/infrastructure/events/outbox-consumer.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";
import { LearningRequestRejectionPublisher } from "../../dist/modules/notifications/infrastructure/events/learning-request-rejection.publisher.js";

const eventId = "123e4567-e89b-42d3-a456-426614174000";
const ownerId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const event = {
  eventId,
  type: "learning-request.rejected",
  version: 1,
  correlationId: "33333333-3333-4333-8333-333333333333",
  payload: {
    requestId,
    ownerId,
    reviewedVersion: 3,
    decisionVersion: 4,
    rejectReason: "Please add a clearer learning goal",
  },
};

function deliveryHarness(failInsert = false) {
  const state = { receipts: new Set(), notifications: new Map() };
  const transactions = {
    run: async (work) => {
      const receipts = new Set(state.receipts);
      const notifications = new Map(state.notifications);
      const tx = {
        $executeRaw: async (_strings, consumer, id) => {
          const key = `${consumer}:${id}`;
          if (receipts.has(key)) return 0;
          receipts.add(key);
          return 1;
        },
        notification: {
          create: async ({ data }) => {
            if (failInsert) throw new Error("notification insert failed");
            notifications.set(data.id, structuredClone(data));
            return data;
          },
        },
      };
      const result = await work(tx);
      state.receipts = receipts;
      state.notifications = notifications;
      return result;
    },
  };
  const consumer = new OutboxConsumer(transactions);
  const repository = {
    createLearningRequestRejected: async (tx, id, payload) =>
      tx.notification.create({
        data: {
          id,
          userId: payload.ownerId,
          type: "LEARNING_REQUEST_REJECTED",
          title: "Learning request update",
          body: `Your learning request was rejected: ${payload.rejectReason}`,
          payload: {
            requestId: payload.requestId,
            reviewedVersion: payload.reviewedVersion,
            decisionVersion: payload.decisionVersion,
          },
          channel: "IN_APP",
        },
      }),
  };
  const registry = new OutboxPublisherRegistry();
  const publisher = new LearningRequestRejectionPublisher(
    consumer,
    repository,
    registry,
  );
  return { publisher, registry, state };
}

test("replay creates one owner notification from the original rejection snapshot", async () => {
  const { publisher, registry, state } = deliveryHarness();
  publisher.onModuleInit();
  await publisher.publish(event);
  await publisher.publish(event);
  assert.equal(registry.get(event.type), publisher);
  assert.equal(state.receipts.size, 1);
  assert.equal(state.notifications.size, 1);
  const notification = state.notifications.get(eventId);
  assert.equal(notification.userId, ownerId);
  assert.equal(notification.id, eventId);
  assert.equal(notification.channel, "IN_APP");
  assert.match(notification.body, /Please add a clearer learning goal/);
  assert.deepEqual(notification.payload, {
    requestId,
    reviewedVersion: 3,
    decisionVersion: 4,
  });
});

test("notification insert failure rolls back the dedupe receipt for retry", async () => {
  const { publisher, state } = deliveryHarness(true);
  await assert.rejects(() => publisher.publish(event));
  assert.equal(state.receipts.size, 0);
  assert.equal(state.notifications.size, 0);
});

test("publisher rejects unsupported event versions and malformed payloads", async () => {
  const { publisher, state } = deliveryHarness();
  for (const invalid of [
    { ...event, version: 2 },
    { ...event, payload: { ...event.payload, ownerId: "not-a-uuid" } },
    { ...event, payload: { ...event.payload, rejectReason: "short" } },
  ]) {
    await assert.rejects(() => publisher.publish(invalid));
  }
  assert.equal(state.receipts.size, 0);
  assert.equal(state.notifications.size, 0);
});
