import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionLifecycleWorker } from "../../dist/modules/learning-sessions/infrastructure/jobs/session-lifecycle.worker.js";
import { createFakeDb } from "../learning-platform/fake-db.mjs";

test("sweep visits rows beyond its first page and serializes overlapping sweeps", async () => {
  const db = createFakeDb();
  const now = new Date("2026-11-02T03:30:00Z");
  for (let i = 0; i < 205; i++)
    db.seed("session", {
      id: String(i).padStart(5, "0"),
      status: "CONFIRMED",
      startAt: now,
      endAt: new Date(+now + 60000),
      roomName: null,
    });
  const seen = [];
  const sessions = {
    advanceLifecycle: async (row) => {
      seen.push(row.id);
      await Promise.resolve();
    },
    trySettleCompletedPath: async () => {},
  };
  const worker = new SessionLifecycleWorker(
    db,
    sessions,
    { config: { enabled: false } },
    { now: () => now },
  );
  await Promise.all([worker.sweep(now, 100), worker.sweep(now, 100)]);
  assert.equal(seen.length, 205);
  assert.equal(new Set(seen).size, 205);
  worker.onModuleDestroy();
  await worker.sweep(now, 100);
  assert.equal(seen.length, 205);
});

test("one failed row does not starve later session recovery", async () => {
  const db = createFakeDb();
  const now = new Date();
  for (const id of ["a", "b"])
    db.seed("session", {
      id,
      status: "CONFIRMED",
      startAt: now,
      endAt: new Date(+now + 60000),
      roomName: null,
    });
  const seen = [];
  const worker = new SessionLifecycleWorker(
    db,
    {
      advanceLifecycle: async (row) => {
        seen.push(row.id);
        if (row.id === "a") throw new Error("unavailable");
      },
      trySettleCompletedPath: async () => {},
    },
    { config: { enabled: false } },
    { now: () => now },
  );
  await worker.sweep(now, 100);
  assert.deepEqual(seen, ["a", "b"]);
});
