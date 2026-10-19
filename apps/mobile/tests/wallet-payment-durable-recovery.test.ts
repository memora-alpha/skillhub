import assert from "node:assert/strict";
import test from "node:test";
import { createCorrelationStore } from "../src/features/wallet/storage/correlation-store-core";
import {
  makeRecoveryRecord,
  parseRecoveryRecord,
} from "../src/features/wallet/utils/payment-recovery-record";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentWire, paymentId } from "./fixtures/payment-api";

const identity = {
  ownerId: "owner-a",
  environment: "https://qa.invalid/api/v1",
};
const record = () =>
  makeRecoveryRecord({
    ...identity,
    key: "stable-key",
    localIntentId: "local-1",
    body: { paymentAmountVnd: "123000", gateway: "PAYOS" },
  });
function fixture() {
  let raw: string | null = null,
    mode = "ok",
    current = true;
  const events: string[] = [];
  const boundary = {
    read: async () => {
      events.push("read");
      if (mode === "read") throw Error();
      return raw;
    },
    write: async (s: string) => {
      events.push("write");
      if (mode === "write") throw Error();
      raw = s;
    },
    remove: async () => {
      events.push("delete");
      if (mode === "delete") throw Error();
      raw = null;
    },
  };
  return {
    boundary,
    events,
    store: createCorrelationStore(identity, boundary, () => current),
    set: (s: string | null) => {
      raw = s;
    },
    get: () => raw,
    mode: (m: string) => {
      mode = m;
    },
    logout: () => {
      current = false;
    },
  };
}
test("record is immutable, exact, bounded and rejects wrong identity/unknown secret fields", () => {
  const r = record();
  assert(Object.isFrozen(r.body));
  assert.equal(r.dispatchMarker, "MAY_HAVE_DISPATCHED");
  for (const change of [
    { ownerId: "b" },
    { environment: "other" },
    { key: "x\n" },
    { key: "x".repeat(129) },
    { paymentId: "bad" },
    { qrCode: "secret" },
    { localIntentId: "🧪".repeat(1000) },
  ])
    assert.throws(() => parseRecoveryRecord({ ...r, ...change }, identity));
  for (const amount of ["1e3", "1001", "01000", "2001000"])
    assert.throws(() =>
      makeRecoveryRecord({
        ...r,
        body: { paymentAmountVnd: amount, gateway: "PAYOS" },
      }),
    );
});
test("durable claim/read-back precedes dispatch, repeated claim same identity; capacity blocks replacement", async () => {
  const f = fixture();
  await f.store.claim(record());
  assert.deepEqual(f.events, ["read", "write", "read"]);
  assert.deepEqual(await f.store.load(), record());
  await f.store.claim(record());
  await assert.rejects(f.store.claim({ ...record(), key: "other-key" }));
  await f.store.bindId("stable-key", paymentId);
  assert.equal((await f.store.load())?.paymentId, paymentId);
  const remount = createCorrelationStore(identity, f.boundary, () => true);
  assert.equal((await remount.load())?.key, "stable-key");
});
test("unresolved survives logout, cannot write in retired session or expose another owner", async () => {
  const f = fixture();
  await f.store.claim(record());
  f.logout();
  await assert.rejects(f.store.bindId("stable-key", paymentId));
  assert(f.get());
  const b = createCorrelationStore(
    { ...identity, ownerId: "b" },
    f.boundary,
    () => true,
  );
  await assert.rejects(b.load());
  const a = createCorrelationStore(identity, f.boundary, () => true);
  assert.equal((await a.load())?.key, "stable-key");
});
test("corruption/oversize/read/write/readback failures never silently prune or create", async () => {
  for (const raw of ["bad-json", "{}", "x".repeat(2048)]) {
    const f = fixture();
    f.set(raw);
    await assert.rejects(f.store.load());
    assert.equal(f.get(), raw);
  }
  for (const mode of ["read", "write"]) {
    const f = fixture();
    f.mode(mode);
    await assert.rejects(f.store.claim(record()));
    assert(!f.events.includes("delete"));
  }
  const bad = createCorrelationStore(
    identity,
    { read: async () => null, write: async () => {}, remove: async () => {} },
    () => true,
  );
  await assert.rejects(bad.claim(record()));
});
test("resolved cleanup verifies binding and tombstone; failure remains blocked, restart completes cleanup", async () => {
  const f = fixture();
  await f.store.claim(record());
  await f.store.bindId("stable-key", paymentId);
  for (const wire of [
    paymentWire("PENDING"),
    {
      ...paymentWire("PAID"),
      recoveryRequired: true,
      recoveryReason: "WARNING",
    },
    {
      ...paymentWire("PAID"),
      paymentAmountVnd: "124000",
      creditAmount: "124.00",
    },
  ])
    await assert.rejects(f.store.resolve(parsePayment(wire)));
  f.mode("delete");
  await assert.rejects(f.store.resolve(parsePayment(paymentWire("PAID"))));
  assert.match(f.get()!, /cleanupPending/);
  await assert.rejects(f.store.load());
  f.mode("ok");
  assert.equal(await f.store.load(), null);
  assert.equal(f.get(), null);
});
test("ID persistence failure leaves conservative retained key; missing ID never authorizes a new intent", async () => {
  const f = fixture();
  await f.store.claim(record());
  f.mode("write");
  await assert.rejects(f.store.bindId("stable-key", paymentId));
  f.mode("ok");
  assert.equal((await f.store.load())?.key, "stable-key");
  assert.equal((await f.store.load())?.paymentId, undefined);
  await assert.rejects(f.store.claim({ ...record(), key: "replacement" }));
});

test("two store instances serialize the same opaque owner slot without overwriting unresolved", async () => {
  const f = fixture();
  const other = createCorrelationStore(identity, f.boundary, () => true);
  const results = await Promise.allSettled([
    f.store.claim(record()),
    other.claim({ ...record(), key: "second-key", localIntentId: "second" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await f.store.load())?.key, "stable-key");
});

test("web durable create storage is unavailable without browser or RAM fallback", async () => {
  const { openPaymentStore } =
    await import("../src/features/wallet/storage/payment-correlation-store.web");
  await assert.rejects(openPaymentStore(identity, () => true));
});
