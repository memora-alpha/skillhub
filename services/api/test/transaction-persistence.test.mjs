import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { skip, withDatabase } from "./integration-db.mjs";

test(
  "business write and outbox roll back together on PostgreSQL",
  {
    skip: !process.env.TEST_DATABASE_URL,
  },
  async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.TEST_DATABASE_URL,
      }),
    });
    const scope = `test:${randomUUID()}`;
    const eventId = randomUUID();
    await prisma.$connect();
    try {
      const runner = new TransactionRunner(prisma);
      await assert.rejects(
        runner.run(async (tx) => {
          await tx.idempotencyRecord.create({
            data: {
              scope,
              operation: "rollback:v1",
              keyDigest: "digest",
              fingerprint: "fingerprint",
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventId,
              aggregateType: "test.rollback",
              aggregateId: eventId,
              dedupeKey: eventId,
              type: "test.rollback",
              version: 1,
              payload: { id: eventId },
              correlationId: randomUUID(),
            },
          });
          throw new Error("fixture failure");
        }),
        /fixture failure/,
      );
      assert.equal(
        await prisma.idempotencyRecord.count({ where: { scope } }),
        0,
      );
      assert.equal(await prisma.outboxEvent.count({ where: { eventId } }), 0);
    } finally {
      await prisma.$disconnect();
    }
  },
);

// Records the sanitized shape of what adapter-pg 7.8.0 really throws, as the regression fixture.
function recording(prisma, shapes) {
  return {
    $transaction: (...args) =>
      prisma.$transaction(...args).catch((error) => {
        const cause = error?.cause ?? error?.meta?.driverAdapterError?.cause;
        shapes.push({
          name: error?.name,
          code: error?.code,
          sqlState: cause?.originalCode,
          kind: cause?.kind,
        });
        throw error;
      }),
  };
}

test(
  "serialization conflict is retried in a fresh transaction",
  { skip },
  (t) =>
    withDatabase(async (prisma) => {
      const shapes = [];
      const runner = new TransactionRunner(recording(prisma, shapes));
      const consumer = `test.serializable-${randomUUID()}`;
      let attempts = 0;
      let reads = 0;
      let release;
      const bothRead = new Promise((resolve) => {
        release = resolve;
      });
      // Write skew: both read the same empty set, then both insert into it.
      const work = async (tx) => {
        attempts++;
        await tx.outboxConsumerReceipt.count({ where: { consumer } });
        if (++reads >= 2) release();
        await bothRead;
        await tx.outboxConsumerReceipt.create({
          data: { consumer, eventId: randomUUID() },
        });
      };
      try {
        await Promise.all([runner.run(work), runner.run(work)]);
        assert.equal(attempts, 3);
        assert.equal(
          await prisma.outboxConsumerReceipt.count({ where: { consumer } }),
          2,
        );
        assert.equal(shapes.length, 1);
        t.diagnostic(`serialization error shape: ${JSON.stringify(shapes[0])}`);
      } finally {
        await prisma.outboxConsumerReceipt.deleteMany({ where: { consumer } });
      }
    }),
);

test("deadlock victim is retried and both writers commit", { skip }, (t) =>
  withDatabase(async (prisma) => {
    const shapes = [];
    const runner = new TransactionRunner(recording(prisma, shapes));
    const type = `test.deadlock-${randomUUID()}`;
    const [left, right] = [randomUUID(), randomUUID()];
    await prisma.outboxEvent.createMany({
      data: [left, right].map((eventId) => ({
        eventId,
        aggregateType: type,
        aggregateId: eventId,
        dedupeKey: eventId,
        type,
        version: 1,
        payload: {},
        correlationId: randomUUID(),
        deliveredAt: new Date(),
      })),
    });
    let attempts = 0;
    let locked = 0;
    let release;
    const bothLocked = new Promise((resolve) => {
      release = resolve;
    });
    const touch = (tx, eventId) =>
      tx.outboxEvent.update({
        where: { eventId },
        data: { lastErrorCode: "TOUCHED" },
      });
    // Opposite lock order; PostgreSQL aborts one after deadlock_timeout.
    const work = (first, second) => async (tx) => {
      attempts++;
      await touch(tx, first);
      if (++locked >= 2) release();
      await bothLocked;
      await touch(tx, second);
    };
    try {
      await Promise.all([
        runner.run(work(left, right), { isolationLevel: "ReadCommitted" }),
        runner.run(work(right, left), { isolationLevel: "ReadCommitted" }),
      ]);
      assert.equal(attempts, 3);
      assert.equal(shapes.length, 1);
      t.diagnostic(`deadlock error shape: ${JSON.stringify(shapes[0])}`);
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { type } });
    }
  }),
);
