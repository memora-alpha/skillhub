import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentEventReader } from "../src/features/wallet/utils/payment-events";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";
import { startPaymentReadLoop } from "../src/features/wallet/utils/payment-auto-read";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import type { PaymentCreateSnapshot } from "../src/features/wallet/utils/payment-create-state";
import { paymentWire, paymentId, otherPaymentId } from "./fixtures/payment-api";
import { deferred } from "./fixtures/payment-observation-model";

const frame = (
  event = "payment.updated",
  data: unknown = {
    paymentId,
    status: "PAID",
    version: "2",
  },
  eventId = otherPaymentId,
) => ({
  event,
  data: JSON.stringify({
    eventId,
    version: 1,
    occurredAt: "2026-10-22T06:00:00Z",
    data,
  }),
});
function fixture() {
  let state: PaymentCreateSnapshot = {
    stage: "known",
    draft: "",
    busy: false,
    readTargetId: paymentId,
    payment: parsePayment(paymentWire()),
  };
  let current = true,
    reads = 0;
  const receive = createPaymentEventReader({
    ownerId: otherPaymentId,
    current: () => current,
    snapshot: () => state,
    read: async () => {
      reads++;
      state = { ...state, payment: parsePayment(paymentWire("PENDING", 2)) };
    },
  });
  return {
    receive,
    state: () => state,
    reads: () => reads,
    replace: (change: Partial<PaymentCreateSnapshot>) => {
      state = { ...state, ...change };
    },
    leave: () => {
      current = false;
    },
  };
}

test("payment.updated triggers an immediate read without treating its PAID hint as proof", async () => {
  const f = fixture(),
    read = deferred<void>();
  let reads = 0;
  const receive = createPaymentEventReader({
    ownerId: otherPaymentId,
    current: () => true,
    snapshot: f.state,
    read: async () => {
      reads++;
      await read.promise;
    },
  });
  const update = receive(frame(), new AbortController().signal);
  assert.equal(reads, 1);
  assert.equal(f.state().payment?.status, "PENDING");
  read.resolve();
  await assert.rejects(update);
  assert.equal(
    f.state().payment?.status,
    "PENDING",
    "only the GET coordinator may confirm PAID",
  );
});

test("duplicate/older/other-payment frames cannot generate redundant payment reads", async () => {
  const f = fixture(),
    signal = new AbortController().signal;
  await f.receive(
    frame("payment.updated", {
      paymentId: otherPaymentId,
      status: "PAID",
      version: "2",
    }),
    signal,
  );
  await f.receive(
    frame("payment.updated", { paymentId, status: "PENDING", version: "1" }),
    signal,
  );
  assert.equal(f.reads(), 0);
  await f.receive(frame(), signal);
  await f.receive(frame(), signal);
  assert.equal(f.reads(), 1);
  await assert.rejects(() =>
    f.receive({ event: "payment.updated", data: "malformed" }, signal),
  );
  await assert.rejects(() =>
    f.receive(
      frame(
        "payment.updated",
        { paymentId, version: "not-a-version" },
        paymentId,
      ),
      signal,
    ),
  );
  assert.equal(f.reads(), 1);
});

test("stream ready and the current owner's wallet event catch up; checkpoints and other owners do not", async () => {
  const f = fixture(),
    signal = new AbortController().signal;
  await f.receive({ event: "stream.ready", data: "{}" }, signal);
  await f.receive(
    frame("wallet.updated", {
      walletUserId: paymentId,
      operationId: paymentId,
    }),
    signal,
  );
  await f.receive({ event: "stream.checkpoint", data: "{}" }, signal);
  await f.receive({ event: "chat.message.created", data: "{}" }, signal);
  assert.equal(f.reads(), 1);
  await f.receive(
    frame("wallet.updated", {
      walletUserId: otherPaymentId,
      operationId: paymentId,
    }),
    signal,
  );
  assert.equal(f.reads(), 2);
});

test("a payment hint ahead of the returned GET remains retryable until that version is observed", async () => {
  const f = fixture();
  let reads = 0;
  const receive = createPaymentEventReader({
    ownerId: otherPaymentId,
    current: () => true,
    snapshot: f.state,
    read: async () => {
      reads++;
    },
  });
  const signal = new AbortController().signal;
  await assert.rejects(() => receive(frame(), signal));
  await assert.rejects(() => receive(frame(), signal));
  assert.equal(
    reads,
    2,
    "an older GET must not consume the newer payment event",
  );
  assert.equal(f.state().payment?.status, "PENDING");
});

test("aborted, denied, unfocused and detached payment consumers never issue reads", async () => {
  const control = new AbortController();
  control.abort();
  const f = fixture();
  await f.receive(frame(), control.signal);
  f.replace({ readDenied: true });
  await f.receive(frame(), new AbortController().signal);
  f.replace({ readDenied: false, readTargetId: undefined });
  await f.receive(frame(), new AbortController().signal);
  f.replace({ readTargetId: paymentId });
  f.leave();
  await f.receive(frame(), new AbortController().signal);
  assert.equal(f.reads(), 0);
});

test("healthy SSE uses a slow safety read; disconnected payment observation retains the fast fallback", () => {
  for (const realtime of [true, false]) {
    let delay = 0;
    const stop = startPaymentReadLoop({
      current: () => true,
      snapshot: () => ({ id: paymentId, status: "PENDING" }),
      realtime: () => realtime,
      read: async () => assert.fail("scheduling must not dispatch"),
      schedule: (_work, value) => {
        delay = value;
        return () => {};
      },
    });
    assert.equal(delay, realtime ? 30000 : 2000);
    stop();
  }
});

test("shared stream acknowledges the cursor only after its payment consumer finishes", async () => {
  const read = deferred<void>(),
    signal = new AbortController().signal;
  let chatReloads = 0;
  const hydration = createChatEventHydrator({
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
    reload: async () => {
      chatReloads++;
    },
    receive: async (event) => {
      if (event.event === "payment.updated") await read.promise;
    },
  });
  await hydration.handle(
    { event: "stream.ready", data: "{}", id: "head" },
    signal,
  );
  const update = hydration.handle({ ...frame(), id: "paid-event" }, signal);
  assert.equal(hydration.cursor, "head");
  read.resolve();
  await update;
  assert.equal(hydration.cursor, "paid-event");
  assert.equal(
    chatReloads,
    1,
    "payment events must not invalidate conversation queries",
  );
});

test("a failing shared-stream consumer does not acknowledge or skip its event", async () => {
  const hydration = createChatEventHydrator({
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
    reload: async () => {},
    receive: async () => {
      throw new Error("reload failed");
    },
  });
  await assert.rejects(() =>
    hydration.handle(
      { ...frame(), id: "unconfirmed" },
      new AbortController().signal,
    ),
  );
  assert.equal(hydration.cursor, undefined);
});
