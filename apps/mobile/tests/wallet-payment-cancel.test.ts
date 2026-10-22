import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { createPaymentApi } from "../src/features/wallet/api/payment-api";
import { createPaymentCoordinator } from "../src/features/wallet/utils/payment-create-coordinator";
import { createCorrelationStore } from "../src/features/wallet/storage/correlation-store-core";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentState } from "../src/features/wallet/utils/payment-outcome";
import { correlationResolved } from "../src/features/wallet/utils/payment-recovery-record";
import { startPaymentReadLoop } from "../src/features/wallet/utils/payment-auto-read";
import { simplePaymentCopy } from "../src/features/wallet/utils/payment-simple-copy";
import { paymentStatusPresentation } from "../src/features/wallet/utils/payment-status-presentation";
import { createPaymentUi } from "../src/features/wallet/utils/payment-create-ui";
import { paymentId, otherPaymentId, paymentWire } from "./fixtures/payment-api";
import { deferred } from "./fixtures/payment-observation-model";

function fixture() {
  let raw: string | null = null,
    status = "PENDING",
    version = 1,
    failure: AppError | undefined,
    detailFailure: AppError | undefined,
    current = true,
    creates = 0,
    keys = 0,
    reads = 0;
  const cancellations: { id: string; key: string }[] = [];
  const identity = {
    ownerId: "cancel-owner",
    environment: "https://test.invalid/api/v1",
  };
  const store = createCorrelationStore(
    identity,
    {
      read: async () => raw,
      write: async (value) => {
        raw = value;
      },
      remove: async () => {
        raw = null;
      },
    },
    () => current,
  );
  const options = {
    identity,
    scope: { ownerId: identity.ownerId, generation: 1 },
    current: () => current,
    openStore: async () => store,
    newKey: () => `create-key-${++keys}`,
    api: {
      creationPolicy: async () => ({
        canCreate: true,
        reasonCode: null,
        existingPaymentId: null,
      }),
      create: async () => {
        creates++;
        return paymentWire();
      },
      detail: async (id: string, signal: AbortSignal) => {
        assert.equal(id, paymentId);
        assert.equal(signal.aborted, false);
        reads++;
        if (detailFailure) throw detailFailure;
        return paymentWire(status, version);
      },
      cancel: async (id: string, key: string, _signal: AbortSignal) => {
        assert.equal(_signal.aborted, false);
        cancellations.push({ id, key });
        if (failure) throw failure;
        status = "CANCELLED";
        return paymentWire(status, ++version);
      },
    },
  };
  const model = createPaymentCoordinator(options);
  return {
    model,
    options,
    store,
    cancellations,
    raw: () => raw,
    counts: () => ({ creates, keys, reads }),
    status: (value: string) => {
      status = value;
      version++;
    },
    failure: (value?: AppError) => {
      failure = value;
    },
    detailFailure: (value?: AppError) => {
      detailFailure = value;
    },
    logout: () => {
      current = false;
    },
    prepare: async () => {
      await model.bootstrap();
      model.edit("123000");
      await model.review();
      await model.confirm();
    },
  };
}

test("an event read waits for the older poll then fetches a fresh PAID projection", async () => {
  const f = fixture();
  await f.prepare();
  const earlier = deferred<ReturnType<typeof paymentWire>>();
  let reads = 0;
  f.options.api.detail = async () => {
    reads++;
    return reads === 1 ? earlier.promise : paymentWire("PAID", 2);
  };
  const poll = f.model.check();
  const event = f.model.check(true);
  assert.equal(reads, 1);
  earlier.resolve(paymentWire());
  await Promise.all([poll, event]);
  assert.equal(reads, 2);
  assert.equal(f.model.getSnapshot().payment?.status, "PAID");
  assert.equal(f.model.getSnapshot().canCancel, false);
  assert.equal(f.model.getSnapshot().cancelling, false);
  assert.equal(f.cancellations.length, 0);
});

test("a queued event read cannot resume after the focused payment session is released", async () => {
  const f = fixture();
  await f.prepare();
  const earlier = deferred<ReturnType<typeof paymentWire>>();
  let reads = 0;
  f.options.api.detail = async () => {
    reads++;
    return earlier.promise;
  };
  const poll = f.model.check();
  const event = f.model.check(true);
  f.model.pause();
  earlier.resolve(paymentWire("PAID", 2));
  await Promise.all([poll, event]);
  assert.equal(reads, 1);
  assert.equal(f.model.getSnapshot().payment?.status, "PENDING");
  assert.equal(f.cancellations.length, 0);
});

test("cancel API uses authenticated bodyless POST, one key and no auth-renewal replay", async () => {
  const calls: { path: string; options: unknown }[] = [];
  const api = createPaymentApi({
    request: async (path, options) => {
      calls.push({ path, options });
      return paymentWire("CANCELLED", 2);
    },
  });
  const signal = new AbortController().signal;
  const result = await api.cancel(paymentId, "cancel-key", signal);
  assert.equal(result.status, "CANCELLED");
  assert.deepEqual(calls, [
    {
      path: `/payments/${paymentId}/cancel`,
      options: {
        method: "POST",
        authenticated: true,
        idempotencyKey: "cancel-key",
        signal,
        replayAfterRenewal: false,
      },
    },
  ]);
  await assert.rejects(() => api.cancel("invalid", "cancel-key", signal));
  await assert.rejects(() => api.cancel(paymentId, "bad key", signal));
  assert.equal(calls.length, 1);
  const wrong = createPaymentApi({
    request: async () => ({ ...paymentWire("CANCELLED"), id: otherPaymentId }),
  });
  await assert.rejects(() => wrong.cancel(paymentId, "cancel-key", signal));
});

test("CANCELLED is terminal for outcome, polling and durable recovery", async () => {
  assert.equal(paymentState("CANCELLED"), "CANCELLED");
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({ id: paymentId, status: "CANCELLED" }),
    read: async () => assert.fail("terminal must not read"),
    schedule: () => assert.fail("terminal must not schedule"),
  });
  const f = fixture();
  await f.prepare();
  const record = await f.store.load();
  assert(record);
  assert(
    correlationResolved(record, parsePayment(paymentWire("CANCELLED", 2))),
  );
  f.status("CANCELLED");
  const restored = createPaymentCoordinator(f.options);
  await restored.bootstrap();
  assert.equal(f.raw(), null);
  assert.equal(restored.getSnapshot().canStartNext, true);
  assert.equal(f.cancellations.length, 0);
});

test("explicit cancellation coalesces, resolves the retained intent and never creates another top-up", async () => {
  const f = fixture();
  await f.prepare();
  assert.equal(f.model.getSnapshot().canCancel, true);
  await Promise.all([f.model.cancel(), f.model.cancel()]);
  assert.equal(f.cancellations.length, 1);
  assert.equal(f.model.getSnapshot().payment?.status, "CANCELLED");
  assert.equal(f.model.getSnapshot().canCancel, false);
  assert.equal(f.model.getSnapshot().canStartNext, true);
  assert.equal(f.raw(), null);
  assert.deepEqual(f.counts(), { creates: 1, keys: 1, reads: 0 });
});

test("background checks retain the same QR and cancel availability throughout every request", async () => {
  const f = fixture();
  await f.prepare();
  const initial = f.model.getSnapshot().payment!;
  const snapshots: ReturnType<typeof f.model.getSnapshot>[] = [];
  const unsubscribe = f.model.subscribe(() =>
    snapshots.push(f.model.getSnapshot()),
  );
  for (let index = 0; index < 3; index++) {
    const response = deferred<ReturnType<typeof paymentWire>>();
    f.options.api.detail = async () => response.promise;
    const previous = f.model.getSnapshot().payment;
    const checking = f.model.check();
    const during = f.model.getSnapshot();
    assert.equal(during.checking, true);
    assert.equal(during.busy, true);
    assert.equal(
      during.canCancel,
      true,
      "a GET must not remove the cancel action",
    );
    assert.equal(during.payment, previous);
    response.resolve(paymentWire());
    await checking;
    assert.equal(f.model.getSnapshot().checking, false);
  }
  unsubscribe();
  assert(snapshots.every((snapshot) => snapshot.canCancel));
  assert(
    snapshots.every(
      (snapshot) =>
        snapshot.payment?.checkout?.qrCode === initial.checkout?.qrCode,
    ),
  );
  assert(
    snapshots.every(
      (snapshot) => createPaymentUi(snapshot).qr.stage === "ready-model",
    ),
  );
  assert.equal(f.counts().creates, 1);
});

test("confirmed cancel interrupts a slow GET instead of waiting, and its late result cannot replace the outcome", async () => {
  const f = fixture();
  await f.prepare();
  const response = deferred<ReturnType<typeof paymentWire>>();
  const cancelResponse = deferred<ReturnType<typeof paymentWire>>();
  let readSignal: AbortSignal | undefined;
  f.options.api.detail = async (_id, signal) => {
    readSignal = signal;
    return response.promise; // Deliberately ignores abort to simulate late transport.
  };
  f.options.api.cancel = async (id, key) => {
    f.cancellations.push({ id, key });
    return cancelResponse.promise;
  };
  const checking = f.model.check();
  const cancelled = f.model.cancel();
  assert.equal(
    readSignal?.aborted,
    true,
    "cancel must not queue behind a slow read",
  );
  assert.equal(f.cancellations.length, 1);
  response.resolve(paymentWire("PAID", 99));
  await checking;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.model.getSnapshot().payment?.status, "PENDING");
  assert.equal(
    f.model.getSnapshot().busy,
    true,
    "old GET must not unlock an in-flight command",
  );
  assert.equal(f.model.getSnapshot().checking, false);
  cancelResponse.resolve(paymentWire("CANCELLED", 2));
  await cancelled;
  assert.equal(f.model.getSnapshot().payment?.status, "CANCELLED");
  assert.equal(f.raw(), null);
});

test("polling cannot abort or overlap an explicit cancellation", async () => {
  const f = fixture();
  await f.prepare();
  const response = deferred<ReturnType<typeof paymentWire>>();
  let commandSignal: AbortSignal | undefined;
  f.options.api.cancel = async (_id, _key, signal) => {
    commandSignal = signal;
    return response.promise;
  };
  const cancelling = f.model.cancel();
  const checking = f.model.check();
  assert.equal(commandSignal?.aborted, false);
  assert.equal(f.model.getSnapshot().checking, false);
  assert.equal(f.counts().reads, 0);
  response.resolve(paymentWire("CANCELLED", 2));
  await Promise.all([cancelling, checking]);
  assert.equal(f.model.getSnapshot().payment?.status, "CANCELLED");
});

test("failed reads retain the pending payment and identity but cannot authorize cancel until a fresh read", async () => {
  const f = fixture();
  await f.prepare();
  const payment = f.model.getSnapshot().payment;
  for (let attempt = 0; attempt < 2; attempt++) {
    f.detailFailure(new AppError("network"));
    await f.model.check();
    const stale = f.model.getSnapshot();
    assert.equal(stale.stage, "known");
    assert.equal(stale.payment, payment);
    assert.equal(stale.observation?.stale, true);
    assert.equal(stale.canCancel, false);
    assert(f.raw());
    await f.model.cancel();
    assert.equal(f.cancellations.length, 0);
  }
  f.detailFailure();
  await f.model.check();
  assert.equal(f.model.getSnapshot().canCancel, true);
  assert.equal(f.model.getSnapshot().payment?.status, "PENDING");
  assert.equal(f.cancellations.length, 0);
  assert.equal(f.counts().creates, 1);
});

test("explicit cancel after a stale read verifies fresh status before sending a single cancel", async () => {
  const f = fixture();
  await f.prepare();
  f.detailFailure(new AppError("network"));
  await f.model.check();
  assert.equal(f.model.getSnapshot().canCancel, false);
  f.detailFailure();
  const reads = f.counts().reads;
  await Promise.all([f.model.cancel(), f.model.cancel()]);
  assert.equal(f.counts().reads, reads + 1);
  assert.equal(f.cancellations.length, 1);
  assert.equal(f.model.getSnapshot().payment?.status, "CANCELLED");
});

test("stale confirmation obeys fresh PAID/REVIEW and owner denial without dispatching cancellation", async () => {
  for (const status of ["PAID", "REVIEW"]) {
    const f = fixture();
    await f.prepare();
    f.detailFailure(new AppError("network"));
    await f.model.check();
    f.detailFailure();
    f.status(status);
    await f.model.cancel();
    assert.equal(f.model.getSnapshot().payment?.status, status);
    assert.equal(f.cancellations.length, 0);
    assert.equal(f.model.getSnapshot().canCancel, false);
  }
  for (const status of [403, 404]) {
    const f = fixture();
    await f.prepare();
    f.detailFailure(new AppError("network"));
    await f.model.check();
    f.detailFailure(new AppError("http", status));
    await f.model.cancel();
    assert.equal(f.cancellations.length, 0);
    assert.equal(f.model.getSnapshot().readDenied, true);
    assert.equal(f.model.getSnapshot().payment, undefined);
    assert(f.raw(), "denial must retain durable correlation");
  }
});

test("leaving during the fresh check cannot dispatch cancellation when that response arrives", async () => {
  const f = fixture();
  await f.prepare();
  f.detailFailure(new AppError("network"));
  await f.model.check();
  const response = deferred<ReturnType<typeof paymentWire>>();
  let signal: AbortSignal | undefined;
  f.options.api.detail = async (_id, value) => {
    signal = value;
    return response.promise;
  };
  const cancelling = f.model.cancel();
  assert(signal, "explicit confirmation must start a fresh read");
  f.model.pause();
  assert.equal(signal.aborted, true);
  response.resolve(paymentWire());
  await cancelling;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.cancellations.length, 0);
  assert(f.raw());
});

test("timeout/busy keep cancellation unconfirmed, retry uses the same key across restart", async () => {
  for (const error of [
    new AppError("network"),
    new AppError("http", 409, "PAYMENT_CHECKOUT_BUSY"),
    new AppError("http", 503, "PAYMENT_CANCELLATION_UNCONFIRMED"),
  ]) {
    const f = fixture();
    await f.prepare();
    f.failure(error);
    await f.model.cancel();
    assert.equal(f.model.getSnapshot().payment?.status, "PENDING");
    assert.equal(f.model.getSnapshot().cancelUnconfirmed, true);
    assert.equal(f.model.getSnapshot().canStartNext, false);
    assert(f.raw());
    assert(f.model.getSnapshot().cancelNotice);
    const firstKey = f.cancellations[0]!.key;
    assert.notEqual(firstKey, "create-key-1");
    const restored = createPaymentCoordinator(f.options);
    await restored.bootstrap();
    assert.equal(f.cancellations.length, 1, "restart must only GET");
    f.failure();
    await restored.cancel();
    assert.equal(f.cancellations[1]!.key, firstKey);
    assert.equal(restored.getSnapshot().payment?.status, "CANCELLED");
    assert.equal(f.counts().creates, 1);
    assert.equal(f.counts().keys, 1);
  }
});

test("cancel response lost after PAID/CANCELLED is reconciled by GET, PAID/REVIEW cannot dispatch cancel", async () => {
  for (const status of ["PAID", "CANCELLED", "REVIEW"]) {
    const f = fixture();
    await f.prepare();
    f.status(status);
    f.failure(new AppError("network"));
    await f.model.cancel();
    assert.equal(f.model.getSnapshot().payment?.status, status);
    assert.equal(f.model.getSnapshot().canCancel, false);
    await f.model.cancel();
    assert.equal(f.cancellations.length, 1);
    assert.equal(f.counts().creates, 1);
    assert.equal(f.raw() === null, status !== "REVIEW");
  }
});

test("cancel failures plus read failures never confirm or discard identity; denial hides private result", async () => {
  for (const error of [
    new AppError("network"),
    new AppError("http", 403),
    new AppError("http", 404),
  ]) {
    const f = fixture();
    await f.prepare();
    f.failure(new AppError("network"));
    f.detailFailure(error);
    await f.model.cancel();
    assert.equal(f.model.getSnapshot().canStartNext, false);
    assert(f.raw());
    if (error.status) {
      assert.equal(f.model.getSnapshot().payment, undefined);
      assert.equal(f.model.getSnapshot().readDenied, true);
    } else {
      assert.equal(f.model.getSnapshot().cancelUnconfirmed, true);
      assert.equal(f.model.getSnapshot().observation?.data?.checkout, null);
    }
  }
});

test("retired session and late cancel responses cannot mutate a different owner", async () => {
  const f = fixture();
  await f.prepare();
  let finish!: (value: ReturnType<typeof paymentWire>) => void;
  f.options.api.cancel = async () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = f.model.cancel();
  f.logout();
  f.model.dispose();
  finish(paymentWire("CANCELLED", 2));
  await pending;
  assert.equal(f.model.getSnapshot().stage, "ended");
  assert(
    f.raw(),
    "obsolete response must not clear old owner's durable identity",
  );
});

test("direct cancel denial hides data immediately; readonly/terminal/review cannot dispatch", async () => {
  for (const status of [403, 404]) {
    const f = fixture();
    await f.prepare();
    f.failure(new AppError("http", status));
    await f.model.cancel();
    assert.equal(f.model.getSnapshot().payment, undefined);
    assert.equal(f.model.getSnapshot().readDenied, true);
    assert.equal(f.counts().reads, 0);
    assert(f.raw());
  }
  for (const status of [
    "PAID",
    "REVIEW",
    "EXPIRED",
    "CANCELLED",
    "REFUNDED",
    "FAILED",
  ]) {
    const f = fixture();
    await f.prepare();
    f.status(status);
    await f.model.check();
    await f.model.cancel();
    assert.equal(f.cancellations.length, 0);
  }
  const f = fixture();
  await f.prepare();
  const { cancel: _cancel, ...reads } = f.options.api;
  assert(_cancel);
  const readonly = createPaymentCoordinator({ ...f.options, api: reads });
  await readonly.bootstrap();
  assert.equal(readonly.getSnapshot().canCancel, false);
  await readonly.cancel();
  assert.equal(f.cancellations.length, 0);
});

test("recovery pending remains pending with specific copy; cancelled is readable and filterable", async () => {
  const pending = parsePayment({
    ...paymentWire(),
    checkout: null,
    recoveryRequired: true,
    recoveryReason: "PAYMENT_RECOVERY_PENDING",
  });
  const copy = simplePaymentCopy(
    paymentStatusPresentation({ status: "ready", stale: false, data: pending }),
  );
  assert.match(copy.description, /khôi phục/);
  assert.equal(copy.success, false);
  const cancelled = simplePaymentCopy(
    paymentStatusPresentation({
      status: "ready",
      stale: false,
      data: parsePayment(paymentWire("CANCELLED", 2)),
    }),
  );
  assert.equal(cancelled.title, "Yêu cầu nạp đã hủy");
  assert.equal(cancelled.success, false);
  assert.equal(cancelled.error, false);
  let path = "";
  const api = createPaymentApi({
    request: async () => null,
    requestPage: async (value) => {
      path = value;
      return {
        data: [paymentWire("CANCELLED", 2)],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      };
    },
  });
  await api.list(
    { status: "CANCELLED" },
    undefined,
    new AbortController().signal,
  );
  assert.match(path, /status=CANCELLED/);
});

test("unconfirmed cancellation hides QR; pause/reactivation never resends a cancel", async () => {
  const f = fixture();
  await f.prepare();
  f.failure(new AppError("network"));
  await f.model.cancel();
  assert.equal(createPaymentUi(f.model.getSnapshot()).qr.stage, "unavailable");
  f.model.pause();
  f.model.activate();
  await f.model.check();
  assert.equal(f.cancellations.length, 1);
  assert.equal(createPaymentUi(f.model.getSnapshot()).qr.stage, "unavailable");
  assert.equal(f.counts().creates, 1);
});
