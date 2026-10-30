import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { redisConnectionOptions } from "../../dist/configs/redis.config.js";
import {
  VerificationAiPublisher,
  VerificationAiWorker,
} from "../../dist/modules/verifications/infrastructure/jobs/verification-ai.queue.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";

test(
  "real Redis/BullMQ delivers the reference-only AI job once for duplicate outbox publication",
  {
    timeout: 20000,
    skip: !process.env.TEST_REDIS_URL && "Set TEST_REDIS_URL to isolated Redis",
  },
  async () => {
    const uri = process.env.TEST_REDIS_URL;
    assert.ok(uri, "TEST_REDIS_URL is required");
    const connection = {
      ...redisConnectionOptions(uri),
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
      connectTimeout: 3000,
    };
    const name = `verification-ai-fixture-${randomUUID()}`;
    const prefix = "skillhub-test";
    const queue = new Queue(name, { connection, prefix });
    const events = new QueueEvents(name, { connection, prefix });
    let calls = 0;
    const serviceWorker = new VerificationAiWorker({
      process: async (id) => {
        calls++;
        assert.equal(id, analysisId);
        return "SUCCEEDED";
      },
    });
    const worker = new Worker(name, (job) => serviceWorker.process(job), {
      connection,
      prefix,
      concurrency: 1,
    });
    for (const client of [queue, events, worker]) client.on("error", () => {});
    const analysisId = randomUUID();
    try {
      await Promise.all([
        queue.waitUntilReady(),
        events.waitUntilReady(),
        worker.waitUntilReady(),
      ]);
      const publisher = new VerificationAiPublisher(
        queue,
        new OutboxPublisherRegistry(),
      );
      publisher.onModuleInit();
      const event = {
        eventId: randomUUID(),
        type: "skill.verification.ai.requested",
        version: 1,
        payload: { analysisId },
        correlationId: randomUUID(),
      };
      await publisher.publish(event);
      await publisher.publish(event);
      const job = await queue.getJob(event.eventId);
      assert.deepEqual(job.data, { analysisId });
      assert.equal(await job.waitUntilFinished(events, 10000), "SUCCEEDED");
      assert.equal(calls, 1);
      await assert.rejects(
        publisher.publish({
          ...event,
          payload: { analysisId, storageKey: "private/not-allowed" },
        }),
        /INVALID_AI_EVENT/,
      );
    } finally {
      await worker.close(true);
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  },
);
