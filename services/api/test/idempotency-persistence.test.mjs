import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { IdempotencyService } from "../dist/infrastructure/idempotency/idempotency.service.js";
import { skip, withDatabase } from "./integration-db.mjs";

test(
  "concurrent same-key commands commit one result and replay it",
  {
    skip: !process.env.TEST_DATABASE_URL,
  },
  async () => {
    const database = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.TEST_DATABASE_URL,
      }),
    });
    await database.$connect();
    try {
      const service = new IdempotencyService(new TransactionRunner(database));
      const scope = `test:${randomUUID()}`;
      const input = {
        scope,
        operation: "concurrent:v1",
        key: randomUUID(),
        command: { id: "same" },
      };
      let executions = 0;
      const work = async (tx) => {
        executions++;
        const id = randomUUID();
        await tx.outboxEvent.create({
          data: {
            eventId: id,
            aggregateType: "test.idempotency",
            aggregateId: id,
            dedupeKey: id,
            type: "test.idempotency",
            version: 1,
            payload: { id },
            correlationId: randomUUID(),
          },
        });
        return { id, status: "CREATED" };
      };
      const results = await Promise.all([
        service.execute(input, work),
        service.execute(input, work),
      ]);
      assert.equal(results[0].value.id, results[1].value.id);
      assert.equal(results.filter((result) => result.replayed).length, 1);
      assert.equal(executions, 1);
      assert.equal(
        await database.idempotencyRecord.count({ where: { scope } }),
        1,
      );
      assert.equal(
        await database.outboxEvent.count({
          where: { eventId: results[0].value.id },
        }),
        1,
      );
    } finally {
      await database.$disconnect();
    }
  },
);

test(
  "failed work keeps no claim; a lost response replays; another command or scope never shares a result",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const service = new IdempotencyService(new TransactionRunner(prisma));
      const scope = `test:${randomUUID()}`;
      const input = {
        scope,
        operation: "replay:v1",
        key: randomUUID(),
        command: { amount: "10", to: "wallet" },
      };
      let executions = 0;
      const work = async () => ({
        id: `result-${++executions}`,
        status: "CREATED",
        version: 1,
      });
      try {
        await assert.rejects(
          service.execute(input, async () => {
            throw new Error("business failure");
          }),
          /business failure/,
        );
        assert.equal(
          await prisma.idempotencyRecord.count({ where: { scope } }),
          0,
        );

        const first = await service.execute(input, work);
        assert.deepEqual(first, {
          value: { id: "result-1", status: "CREATED", version: 1 },
          replayed: false,
        });
        // The client lost the response and retries the same command with another key order.
        const replay = await service.execute(
          { ...input, command: { to: "wallet", amount: "10" } },
          work,
        );
        assert.deepEqual(replay, { value: first.value, replayed: true });
        assert.equal(executions, 1);

        await assert.rejects(
          service.execute(
            { ...input, command: { amount: "11", to: "wallet" } },
            work,
          ),
          /different command/,
        );
        const otherActor = await service.execute(
          { ...input, scope: `${scope}:other-actor` },
          work,
        );
        assert.deepEqual(otherActor, {
          value: { id: "result-2", status: "CREATED", version: 1 },
          replayed: false,
        });
      } finally {
        await prisma.idempotencyRecord.deleteMany({
          where: { scope: { startsWith: scope } },
        });
      }
    }),
);
