import assert from "node:assert/strict";
import { test } from "node:test";
import { OutboxDispatcher } from "../dist/infrastructure/events/outbox-dispatcher.js";
import { OutboxPublisherRegistry } from "../dist/infrastructure/events/outbox.types.js";

const eventId = "123e4567-e89b-42d3-a456-426614174000";

test("dispatcher publishes claimed event and acknowledges by lease", async () => {
  const queries = [];
  const database = {
    $queryRaw: async () => [
      {
        event_id: eventId,
        type: "test.event",
        version: 1,
        payload: { id: "x" },
        correlation_id: eventId,
        lease_token: eventId,
      },
    ],
    $executeRaw: async (...args) => (queries.push(args), 1),
  };
  const published = [];
  const publishers = new OutboxPublisherRegistry();
  publishers.register("test.event", {
    publish: async (event) => published.push(event),
  });
  const dispatcher = new OutboxDispatcher(database, publishers);
  assert.equal(await dispatcher.dispatchBatch(), 1);
  assert.deepEqual(published, [
    {
      eventId,
      type: "test.event",
      version: 1,
      payload: { id: "x" },
      correlationId: eventId,
    },
  ]);
  assert.equal(queries.length, 1);
  await dispatcher.onModuleDestroy();
});

test("unknown event type remains failed for operator replay", async () => {
  const queries = [];
  const database = {
    $queryRaw: async () => [
      {
        event_id: eventId,
        type: "unknown",
        version: 1,
        payload: {},
        correlation_id: eventId,
        lease_token: eventId,
        cycle_attempts: 1,
      },
    ],
    $executeRaw: async (...args) => (queries.push(args), 1),
  };
  const publishers = new OutboxPublisherRegistry();
  publishers.register("known", { publish: async () => {} });
  const dispatcher = new OutboxDispatcher(database, publishers);
  assert.equal(await dispatcher.dispatchBatch(), 0);
  assert.equal(queries.length, 1);
  await dispatcher.onModuleDestroy();
});

test("publish failure retains event and manual replay preserves identity", async () => {
  const queries = [];
  const row = {
    event_id: eventId,
    type: "test.event",
    version: 1,
    payload: { id: "x" },
    correlation_id: eventId,
    lease_token: eventId,
    cycle_attempts: 8,
  };
  let replayUpdate;
  const database = {
    $queryRaw: async () => [row],
    $executeRaw: async (...args) => (queries.push(args), 1),
    outboxEvent: {
      updateMany: async (args) => ((replayUpdate = args), { count: 1 }),
    },
  };
  const publishers = new OutboxPublisherRegistry();
  publishers.register("test.event", {
    publish: async () => {
      throw Object.assign(new Error("private provider detail"), {
        code: "SERVICE_DOWN",
      });
    },
  });
  const dispatcher = new OutboxDispatcher(database, publishers);
  assert.equal(await dispatcher.dispatchBatch(), 0);
  assert.equal(queries.length, 1);
  await dispatcher.retryFailed(eventId);
  assert.equal(replayUpdate.where.eventId, eventId);
  assert.deepEqual(replayUpdate.data.replayCount, { increment: 1 });
  assert.equal(replayUpdate.data.cycleAttempts, 0);
  assert.ok(!JSON.stringify(replayUpdate).includes("private provider detail"));
  await dispatcher.onModuleDestroy();
});
