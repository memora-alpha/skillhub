import assert from "node:assert/strict";
import test from "node:test";
import {
  startPaymentReadLoop,
  resumesPayment,
} from "../src/features/wallet/utils/payment-auto-read";

test("automatic reads are sequential, stop on backend final/denial, never replace an unknown intent", async () => {
  for (const final of [
    "PAID",
    "FAILED",
    "EXPIRED",
    "REFUNDED",
    "CANCELLED",
    "denied",
  ]) {
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

test("a newly paid checkout is observed within two seconds plus the API response", async () => {
  for (const initial of ["CREATED", "PENDING"]) {
    let status = initial,
      elapsed = 0,
      checks = 0,
      tick: (() => void) | undefined;
    startPaymentReadLoop({
      current: () => true,
      snapshot: () => ({ id: "id", status }),
      read: async () => {
        checks++;
        elapsed += 750; // Synthetic API latency after the backend confirms PAID.
        status = "PAID";
      },
      schedule: (work, delay) => {
        tick = () => {
          elapsed += delay;
          work();
        };
        return () => {
          tick = undefined;
        };
      },
    });
    tick!();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(status, "PAID");
    assert.equal(checks, 1);
    assert(elapsed <= 2750, `confirmation took ${elapsed}ms for ${initial}`);
    assert.equal(tick, undefined);
  }
});

test("pending reads stay quick for a later bank transfer and preserve ten minutes of scheduled observation", async () => {
  const delays: number[] = [];
  let tick: (() => void) | undefined,
    reads = 0,
    stopped = 0;
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({ id: "id", status: "PENDING" }),
    read: async () => {
      reads++;
    },
    onStop: () => stopped++,
    schedule: (work, delay) => {
      delays.push(delay);
      tick = work;
      return () => {
        tick = undefined;
      };
    },
  });
  while (tick) {
    tick();
    await new Promise((resolve) => setImmediate(resolve));
    assert(reads <= 300, "observation must remain bounded");
  }
  assert.equal(reads, 300);
  assert(delays.every((delay) => delay === 2000));
  assert.equal(
    delays.reduce((sum, delay) => sum + delay, 0),
    600000,
  );
  assert.equal(stopped, 1);
});

test("a recovered read returns to quick checks and stops immediately on PAID", async () => {
  const delays: number[] = [];
  let status = "PENDING",
    stale = false,
    tick: (() => void) | undefined,
    reads = 0;
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({ id: "id", status, stale }),
    read: async () => {
      reads++;
      stale = reads === 1;
      if (stale) throw Error("offline");
      if (reads === 3) status = "PAID";
    },
    schedule: (work, delay) => {
      delays.push(delay);
      tick = work;
      return () => {
        tick = undefined;
      };
    },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    tick!();
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.deepEqual(delays, [2000, 10000, 2000]);
  assert.equal(status, "PAID");
  assert.equal(tick, undefined);
});

test("review and unknown states keep their slower cadence and original read limit", async () => {
  for (const status of ["REVIEW", "UNKNOWN"]) {
    let tick: (() => void) | undefined,
      reads = 0;
    startPaymentReadLoop({
      current: () => true,
      snapshot: () => ({ id: "id", status }),
      read: async () => {
        reads++;
      },
      schedule: (work, delay) => {
        assert.equal(delay, 30000);
        tick = work;
        return () => {
          tick = undefined;
        };
      },
    });
    while (tick) {
      tick();
      await new Promise((resolve) => setImmediate(resolve));
      assert(reads <= 120, "slow observation must remain bounded");
    }
    assert.equal(reads, 120);
  }
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
