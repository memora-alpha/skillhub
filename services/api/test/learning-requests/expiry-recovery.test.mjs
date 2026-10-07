import assert from "node:assert/strict";
import { test } from "node:test";
import { LearningRequestExpiryScheduler } from "../../dist/modules/learning-requests/infrastructure/jobs/learning-request-expiry.scheduler.js";
import { LearningRequestExpiryWorker } from "../../dist/modules/learning-requests/infrastructure/jobs/learning-request-expiry.worker.js";

test("scheduler queues bounded scan triggers with retry and does not persist client state", async () => {
  const calls = [];
  const scheduler = new LearningRequestExpiryScheduler({
    add: async (...args) => calls.push(args),
  });
  scheduler.onModuleInit();
  await new Promise((resolve) => setImmediate(resolve));
  scheduler.onModuleDestroy();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "scan");
  assert.deepEqual(calls[0][1], {});
  assert.match(calls[0][2].jobId, /^learning-request-expiry-\d+$/);
  assert.equal(calls[0][2].attempts, 3);
});

test("worker rescans current database state and ignores stale job snapshots", async () => {
  const calls = [];
  const worker = new LearningRequestExpiryWorker({
    execute: async (batchSize) => calls.push(batchSize),
  });
  await worker.process({
    name: "scan",
    data: { requestId: "stale", status: "OPEN", version: 1 },
  });
  assert.deepEqual(calls, [100]);
  await assert.rejects(() =>
    worker.process({ name: "expire-request", data: {} }),
  );
});
