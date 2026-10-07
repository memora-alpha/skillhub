import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { OutboxConsumer } from "../dist/infrastructure/events/outbox-consumer.js";
import { OutboxDispatcher } from "../dist/infrastructure/events/outbox-dispatcher.js";
import { OutboxPublisherRegistry } from "../dist/infrastructure/events/outbox.types.js";
import { OutboxWriter } from "../dist/infrastructure/events/outbox-writer.js";
import { skip, withDatabase } from "./integration-db.mjs";

// Every test owns one random event type and deletes only its own rows.
const newType = () => `test.outbox-${randomUUID()}`;

async function append(prisma, type, count) {
  const writer = new OutboxWriter();
  const ids = Array.from({ length: count }, () => randomUUID());
  await new TransactionRunner(prisma).run(async (tx) => {
    for (const eventId of ids) {
      await writer.append(tx, {
        eventId,
        type,
        version: 1,
        payload: { id: eventId },
        correlationId: randomUUID(),
      });
    }
  });
  return ids;
}

function dispatcher(prisma, type, publish) {
  const registry = new OutboxPublisherRegistry();
  registry.register(type, { publish });
  return new OutboxDispatcher(prisma, registry);
}

async function drain(dispatchers, done) {
  for (let round = 0; round < 30 && !done(); round++) {
    await Promise.all(dispatchers.map((item) => item.dispatchBatch()));
    if (!done()) await sleep(100);
  }
}

test(
  "two dispatchers deliver each committed event exactly once",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const type = newType();
      try {
        const ids = await append(prisma, type, 30);
        const published = [];
        const publish = async (event) => {
          published.push(event.eventId);
        };
        await drain(
          [
            dispatcher(prisma, type, publish),
            dispatcher(prisma, type, publish),
          ],
          () => published.length >= ids.length,
        );
        assert.deepEqual([...published].sort(), [...ids].sort());
        assert.equal(
          await prisma.outboxEvent.count({
            where: { type, deliveredAt: { not: null }, leaseToken: null },
          }),
          30,
        );
      } finally {
        await prisma.outboxEvent.deleteMany({ where: { type } });
      }
    }),
);

test(
  "crash after publish before ack redelivers the same event and the receipt keeps one side effect",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const type = newType();
      const consumerName = `test.consumer-${randomUUID()}`;
      try {
        const [eventId] = await append(prisma, type, 1);
        const consumer = new OutboxConsumer(new TransactionRunner(prisma));
        const seen = [];
        let effects = 0;
        const publish = async (event) => {
          seen.push(event.eventId);
          await consumer.processOnce(consumerName, event.eventId, async () => {
            effects++;
          });
        };
        // A dispatcher claimed the row, published it, then died before acknowledging.
        await prisma.$executeRaw`
      UPDATE "outbox_events"
      SET "lease_token" = gen_random_uuid(), "lease_until" = CURRENT_TIMESTAMP + INTERVAL '30 seconds',
          "attempts" = 1, "cycle_attempts" = 1
      WHERE "event_id" = ${eventId}::uuid`;
        await publish({ eventId });

        const survivor = dispatcher(prisma, type, publish);
        await survivor.dispatchBatch();
        assert.deepEqual(
          seen,
          [eventId],
          "a live lease must not be claimed by another dispatcher",
        );

        await prisma.$executeRaw`
      UPDATE "outbox_events" SET "lease_until" = CURRENT_TIMESTAMP - INTERVAL '1 hour'
      WHERE "event_id" = ${eventId}::uuid`;
        await drain([survivor], () => seen.length >= 2);
        assert.deepEqual(seen, [eventId, eventId]);
        assert.equal(effects, 1);
        const row = await prisma.outboxEvent.findUniqueOrThrow({
          where: { eventId },
        });
        assert.ok(row.deliveredAt);
        assert.equal(row.totalAttempts, 2);
        assert.equal(row.leaseToken, null);
      } finally {
        await prisma.outboxConsumerReceipt.deleteMany({
          where: { consumer: consumerName },
        });
        await prisma.outboxEvent.deleteMany({ where: { type } });
      }
    }),
);

test(
  "failed publish retains the event, exhausts to failed, and manual replay keeps its identity",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const type = newType();
      try {
        const [eventId] = await append(prisma, type, 1);
        await prisma.outboxEvent.update({
          where: { eventId },
          data: { cycleAttempts: 7, totalAttempts: 7 },
        });
        const seen = [];
        let providerUp = false;
        const subject = dispatcher(prisma, type, async (event) => {
          seen.push(event.eventId);
          if (!providerUp)
            throw Object.assign(new Error("provider detail with DSN"), {
              code: "SERVICE_DOWN",
            });
        });

        await drain([subject], () => seen.length >= 1);
        let row = await prisma.outboxEvent.findUniqueOrThrow({
          where: { eventId },
        });
        assert.ok(row.failedAt);
        assert.equal(row.deliveredAt, null);
        assert.equal(row.leaseToken, null);
        assert.equal(row.lastErrorCode, "SERVICE_DOWN");
        assert.deepEqual([row.cycleAttempts, row.totalAttempts], [8, 8]);
        await subject.dispatchBatch();
        assert.equal(
          seen.length,
          1,
          "a failed event waits for an operator replay",
        );

        providerUp = true;
        await subject.retryFailed(eventId);
        await drain([subject], () => seen.length >= 2);
        row = await prisma.outboxEvent.findUniqueOrThrow({
          where: { eventId },
        });
        assert.deepEqual(seen, [eventId, eventId]);
        assert.ok(row.deliveredAt);
        assert.deepEqual(
          [row.replayCount, row.cycleAttempts, row.totalAttempts],
          [1, 1, 9],
        );
        assert.equal(
          row.lastErrorCode,
          "SERVICE_DOWN",
          "last failure evidence is kept",
        );
        await assert.rejects(subject.retryFailed(eventId), /not found/);
      } finally {
        await prisma.outboxEvent.deleteMany({ where: { type } });
      }
    }),
);
