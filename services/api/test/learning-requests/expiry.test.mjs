import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpireLearningRequestsUseCase } from "../../dist/modules/learning-requests/application/use-cases/expire-learning-requests.use-case.js";

const now = new Date("2026-10-06T00:00:00.000Z");
const id = "22222222-2222-4222-8222-222222222222";

function row(status, expiresAt, version = 2, requestId = id) {
  return { id: requestId, status, version, expiresAt };
}

test("expiry applies at the exact deadline to OPEN and PENDING_MODERATION only", async () => {
  const requestIds = Array.from(
    { length: 9 },
    (_, index) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  const requests = [
    row("OPEN", now, 2, requestIds[0]),
    row("PENDING_MODERATION", new Date(now.getTime() - 1), 3, requestIds[1]),
    row("DRAFT", now, 2, requestIds[2]),
    row("REJECTED", now, 2, requestIds[3]),
    row("NEGOTIATING", now, 2, requestIds[4]),
    row("MATCHED", now, 2, requestIds[5]),
    row("CLOSED", now, 2, requestIds[6]),
    row("CANCELLED", now, 2, requestIds[7]),
    row("EXPIRED", now, 2, requestIds[8]),
  ];
  const transitions = [];
  const tx = { $queryRaw: async () => [] };
  const repository = {
    databaseNow: async () => now,
    findExpired: async (_tx, at, take) => {
      assert.equal(at, now);
      assert.equal(take, 50);
      return requests.map(({ id: requestId, version }) => ({
        id: requestId,
        version,
      }));
    },
    lock: async (_tx, requestId) =>
      requests.find((request) => request.id === requestId),
    transition: async (_tx, requestId, version, from, update) => {
      const request = requests.find((entry) => entry.id === requestId);
      transitions.push({ status: request.status, version, from });
      if (
        request.version !== version ||
        !from.includes(request.status) ||
        request.expiresAt > now
      )
        return false;
      Object.assign(request, update, { version: version + 1 });
      return true;
    },
  };
  let transactions = 0;
  const useCase = new ExpireLearningRequestsUseCase(
    { run: async (work) => ((transactions += 1), work(tx)) },
    repository,
  );
  assert.deepEqual(await useCase.execute(50), { processed: 2 });
  assert.equal(requests[0].status, "EXPIRED");
  assert.equal(requests[1].status, "EXPIRED");
  assert.equal(requests[2].status, "DRAFT");
  assert.equal(requests[3].status, "REJECTED");
  assert.equal(requests[4].status, "NEGOTIATING");
  assert.equal(requests[5].status, "MATCHED");
  assert.equal(requests[6].status, "CLOSED");
  assert.equal(requests[7].status, "CANCELLED");
  assert.equal(requests[8].status, "EXPIRED");
  assert.equal(transitions.length, 2);
  assert.ok(transactions > requests.length);
});

test("stale expiry snapshots cannot overwrite an accepted request or a newer version", async () => {
  const request = row("NEGOTIATING", now, 4, id);
  const tx = { $queryRaw: async () => [] };
  const repository = {
    databaseNow: async () => now,
    findExpired: async () => [{ id, version: 3 }],
    lock: async () => request,
    transition: async (_tx, _id, version, from, update) => {
      if (request.version !== version || !from.includes(request.status))
        return false;
      Object.assign(request, update, { version: version + 1 });
      return true;
    },
  };
  const useCase = new ExpireLearningRequestsUseCase(
    { run: (work) => work(tx) },
    repository,
  );
  assert.deepEqual(await useCase.execute(10), { processed: 0 });
  assert.equal(request.status, "NEGOTIATING");
  assert.equal(request.version, 4);
});

test("expiry batches reject unbounded or invalid sizes before querying", async () => {
  let calls = 0;
  const useCase = new ExpireLearningRequestsUseCase(
    { run: (work) => work({ $queryRaw: async () => [] }) },
    {
      findExpired: async () => ((calls += 1), []),
      databaseNow: async () => now,
    },
  );
  for (const size of [0, -1, 501, 1.5]) {
    await assert.rejects(() => useCase.execute(size));
  }
  assert.equal(calls, 0);
});
