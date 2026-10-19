import assert from "node:assert/strict";
import test from "node:test";
import {
  startPaymentReadLoop,
  resumesPayment,
} from "../src/features/wallet/utils/payment-auto-read";

test("automatic reads are sequential, stop on backend final/denial, never replace an unknown intent", async () => {
  for (const final of ["PAID", "FAILED", "EXPIRED", "REFUNDED", "denied"]) {
    let status = "CREATED",
      reads = 0,
      current = true;
    let scheduled: (() => void) | undefined;
    const stop = startPaymentReadLoop({
      current: () => current,
      snapshot: () => ({ id: "known-id", status, denied: status === "denied" }),
      read: async () => {
        reads++;
        status = final;
      },
      schedule: (fn) => {
        scheduled = fn;
        return () => {
          scheduled = undefined;
        };
      },
    });
    assert(scheduled);
    scheduled!();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reads, 1);
    assert.equal(scheduled, undefined);
    current = false;
    stop();
  }
  let reads = 0;
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({}),
    read: async () => {
      reads++;
    },
    schedule: () => {
      assert.fail("unknown ID must not schedule/replay");
    },
  });
  assert.equal(reads, 0);
});
test("blur/logout cancels timer and an in-flight read cannot reschedule in a new focus", async () => {
  let current = true,
    scheduled: (() => void) | undefined,
    finish: () => void = () => {},
    reads = 0;
  const stop = startPaymentReadLoop({
    current: () => current,
    snapshot: () => ({ id: "id", status: "PENDING" }),
    read: () => {
      reads++;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    schedule: (fn) => {
      scheduled = fn;
      return () => {
        scheduled = undefined;
      };
    },
  });
  const tick = scheduled!;
  tick();
  assert.equal(reads, 1);
  current = false;
  stop();
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scheduled, undefined);
});
test("read errors back off and a finite observation budget never fabricates expiry/failure", async () => {
  const delays: number[] = [];
  let tick: (() => void) | undefined,
    reads = 0,
    ended = 0;
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({ id: "id", status: "PENDING", stale: true }),
    read: async () => {
      reads++;
      throw Error("network");
    },
    maxReads: 2,
    onStop: () => ended++,
    schedule: (fn, delay) => {
      tick = fn;
      delays.push(delay);
      return () => {
        tick = undefined;
      };
    },
  });
  tick!();
  await new Promise((resolve) => setImmediate(resolve));
  tick!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  assert.equal(ended, 1);
  assert.equal(tick, undefined);
  assert(delays[1]! > delays[0]!);
});
test("pending/unknown identity goes straight to Payment; cleaned resolution returns to amount entry", () => {
  for (const stage of ["known", "unknown", "blocked"] as const)
    assert(
      resumesPayment({
        stage,
        busy: false,
        draft: "",
        paymentId: stage === "unknown" ? undefined : "id",
      }),
    );
  assert.equal(
    resumesPayment({
      stage: "known",
      busy: false,
      draft: "",
      paymentId: "id",
      canStartNext: true,
    }),
    false,
  );
  assert.equal(
    resumesPayment({ stage: "draft", busy: false, draft: "" }),
    false,
  );
});

test("a timer captured for one payment cannot read a replacement route identity", async () => {
  let id = "A",
    reads = 0,
    tick: (() => void) | undefined;
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({ id, status: "PENDING" }),
    read: async () => {
      reads++;
    },
    schedule: (fn) => {
      tick = fn;
      return () => {
        tick = undefined;
      };
    },
  });
  id = "B";
  tick!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 0);
  assert.equal(tick, undefined);
});
