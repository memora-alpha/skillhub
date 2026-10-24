import assert from "node:assert/strict";
import test from "node:test";
import { createConnectionStore } from "../src/lib/network/connection-store";
import { startConnectionRecovery } from "../src/lib/network/connection-recovery";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("connection recovery backs off, pauses in background and resets after success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createConnectionStore();
  let calls = 0;
  let succeed = false;
  const retry = async () => {
    const ticket = store.beginRetry();
    if (ticket === null) return;
    calls++;
    store.finishRetry(ticket, succeed);
  };
  const recovery = startConnectionRecovery(store, retry, true);
  t.after(() => recovery.dispose());
  store.unavailable();
  for (const delay of [5_000, 10_000, 20_000, 30_000, 30_000]) {
    const previous = calls;
    t.mock.timers.tick(delay - 1);
    assert.equal(calls, previous);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(calls, previous + 1);
  }
  recovery.setActive(false);
  t.mock.timers.tick(120_000);
  assert.equal(calls, 5);
  succeed = true;
  recovery.setActive(true);
  await flush();
  assert.equal(calls, 6);
  assert.equal(store.getSnapshot().reason, null);
  t.mock.timers.tick(120_000);
  assert.equal(calls, 6);
  succeed = false;
  store.unavailable("offline");
  t.mock.timers.tick(5_000);
  await flush();
  assert.equal(calls, 7);
  recovery.dispose();
  store.unavailable();
  t.mock.timers.tick(120_000);
  assert.equal(calls, 7);
});

test("a slow probe cannot overlap with another scheduled recovery", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = createConnectionStore();
  store.unavailable();
  let release!: () => void;
  let calls = 0;
  const recovery = startConnectionRecovery(
    store,
    async () => {
      const ticket = store.beginRetry();
      if (ticket === null) return;
      calls++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      store.finishRetry(ticket, false);
    },
    true,
  );
  t.after(() => recovery.dispose());
  t.mock.timers.tick(5_000);
  assert.equal(calls, 1);
  t.mock.timers.tick(120_000);
  assert.equal(calls, 1);
  release();
  await flush();
  t.mock.timers.tick(9_999);
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  assert.equal(calls, 2);
  release();
  await flush();
});
