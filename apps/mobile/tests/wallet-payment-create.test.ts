import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentApi } from "../src/features/wallet/api/payment-api";
import { paymentWire, paymentId } from "./fixtures/payment-api";
import { AppError } from "../src/lib/http/errors";
import { createPaymentCoordinator } from "../src/features/wallet/utils/payment-create-coordinator";
import { createCorrelationStore } from "../src/features/wallet/storage/correlation-store-core";
import { startPaymentReadLoop } from "../src/features/wallet/utils/payment-auto-read";

function coordinatorFixture() {
  let raw: string | null = null,
    current = true,
    posts = 0,
    gets = 0,
    keys = 0,
    mode = "ok",
    policyMode = "ok";
  const identity = {
    ownerId: "owner-a",
    environment: "https://qa.invalid/api/v1",
  };
  const store = createCorrelationStore(
    identity,
    {
      read: async () => raw,
      write: async (s) => {
        raw = s;
      },
      remove: async () => {
        raw = null;
      },
    },
    () => current,
  );
  const create = async () => {
    posts++;
    if (mode === "timeout") throw new AppError("network");
    if (mode === "malformed") return {};
    if (mode !== "ok") throw new AppError("http", Number(mode) || 503, mode);
    return paymentWire();
  };
  const api = {
    creationPolicy: async () => ({
      canCreate: policyMode === "ok",
      reasonCode: policyMode === "ok" ? null : policyMode,
      existingPaymentId: [
        "PAYMENT_UNRESOLVED",
        "PAYMENT_RECONCILIATION_REQUIRED",
      ].includes(policyMode)
        ? paymentId
        : null,
    }),
    create,
    detail: async () => {
      gets++;
      if (mode === "404") throw new AppError("http", 404);
      return paymentWire("PAID", 2);
    },
  };
  const options = {
    identity,
    scope: { ownerId: identity.ownerId, generation: 1 },
    current: () => current,
    openStore: async () => store,
    api,
    newKey: () => {
      keys++;
      return `key-${keys}`;
    },
  };
  return {
    model: createPaymentCoordinator(options),
    options,
    store,
    raw: () => raw,
    counts: () => ({ posts, gets, keys }),
    mode: (m: string) => {
      mode = m;
    },
    policy: (m: string) => {
      policyMode = m;
    },
    logout: () => {
      current = false;
    },
  };
}
test("durable coordinator claims synchronously across callers, preserves draft and performs reads after known ID", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  await Promise.all([f.model.confirm(), f.model.confirm(), f.model.confirm()]);
  assert.deepEqual(f.counts(), { posts: 1, gets: 0, keys: 1 });
  assert.equal(f.model.getSnapshot().payment?.id, paymentId);
  assert.match(f.raw()!, /key-1/);
  await f.model.check();
  assert.equal(f.model.getSnapshot().payment?.status, "PAID");
  assert.equal(f.raw(), null);
  assert.equal(f.counts().posts, 1);
});
test("timeout and every ambiguous rejection retain identity; only explicit replay reuses the exact key/body", async () => {
  for (const failure of [
    "timeout",
    "malformed",
    "401",
    "409",
    "429",
    "500",
    "503",
  ]) {
    const f = coordinatorFixture();
    await f.model.bootstrap();
    f.model.edit("123000");
    await f.model.review();
    f.mode(failure);
    await f.model.confirm();
    assert.equal(f.model.getSnapshot().stage, "unknown");
    assert.match(f.raw()!, /key-1/);
    await f.model.confirm();
    assert.equal(f.counts().posts, 1);
    assert.equal(f.counts().keys, 1);
    // Remount/restoration never dispatches create or matches by amount/time.
    const restored = createPaymentCoordinator(f.options);
    await restored.bootstrap();
    assert.equal(restored.getSnapshot().stage, "unknown");
    assert.equal(f.counts().posts, 1);
    f.mode("ok");
    await restored.replay();
    assert.equal(f.counts().posts, 2);
    assert.equal(f.counts().keys, 1);
  }
});
test("policy→POST race, pause/disabled and reported total loss never allow fresh replacement", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("2000");
  await f.model.review();
  f.policy("PAYMENT_CREATION_PAUSED");
  await f.model.confirm();
  assert.equal(f.counts().posts, 0);
  assert.equal(f.counts().keys, 0);
  const lost = coordinatorFixture();
  await lost.model.bootstrap();
  lost.model.supportStop();
  lost.model.edit("2000");
  await lost.model.review();
  await lost.model.confirm();
  assert.equal(lost.counts().posts, 0);
});
test("known ID restart only GETs; 404 and session retirement retain correlation and stop", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  await f.model.confirm();
  f.mode("404");
  const restored = createPaymentCoordinator(f.options);
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().stage, "blocked");
  assert.equal(restored.getSnapshot().payment, undefined);
  assert(f.raw());
  assert.equal(f.counts().posts, 1);
  f.logout();
  f.model.dispose();
  await f.model.replay();
  assert.equal(f.counts().posts, 1);
  assert.equal(f.model.getSnapshot().stage, "ended");
});

test("explicit POST binds exact two-field body/key/signal and disables renewal replay", async () => {
  const signal = new AbortController().signal;
  let calls = 0;
  const api = createPaymentApi({
    request: async (path, options) => {
      calls++;
      assert.equal(path, "/payments");
      assert.deepEqual(options?.body, {
        paymentAmountVnd: "123000",
        gateway: "PAYOS",
      });
      assert.equal(options?.method, "POST");
      assert.equal(options?.idempotencyKey, "same-key");
      assert.equal(options?.authenticated, true);
      assert.equal(options?.signal, signal);
      assert.equal(options?.replayAfterRenewal, false);
      return paymentWire(calls === 1 ? "CREATED" : "PAID");
    },
  });
  assert.equal(
    (
      await api.create(
        { paymentAmountVnd: "123000", gateway: "PAYOS" },
        "same-key",
        signal,
      )
    ).id,
    paymentId,
  );
  assert.equal(
    (
      await api.create(
        { paymentAmountVnd: "123000", gateway: "PAYOS" },
        "same-key",
        signal,
      )
    ).status,
    "PAID",
  );
  assert.equal(calls, 2);
});
test("invalid body/key never dispatch and HTTP failures are never auto-retried", async () => {
  let calls = 0;
  const signal = new AbortController().signal;
  const api = createPaymentApi({
    request: async () => {
      calls++;
      throw new AppError("http", 409, "PAYMENT_RECONCILIATION_REQUIRED");
    },
  });
  for (const key of ["", "bad\n", "x".repeat(129)])
    await assert.rejects(
      api.create({ paymentAmountVnd: "1000", gateway: "PAYOS" }, key, signal),
    );
  for (const amount of ["1001", "0", "2001000", "1e3"])
    await assert.rejects(
      api.create(
        { paymentAmountVnd: amount, gateway: "PAYOS" },
        "same",
        signal,
      ),
    );
  assert.equal(calls, 0);
  await assert.rejects(
    api.create({ paymentAmountVnd: "1000", gateway: "PAYOS" }, "same", signal),
  );
  assert.equal(calls, 1);
});

test("background after dispatch and late response cannot change new session or replay", async () => {
  const f = coordinatorFixture();
  let finish: (value: unknown) => void = () => {};
  const model = createPaymentCoordinator({
    ...f.options,
    api: {
      ...f.options.api,
      create: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  });
  await model.bootstrap();
  model.edit("123000");
  await model.review();
  const pending = model.confirm();
  while (!f.raw()) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  model.pause();
  assert.equal(model.getSnapshot().stage, "unknown");
  finish(paymentWire());
  await pending;
  assert.equal(model.getSnapshot().payment, undefined);
  assert.equal(model.getSnapshot().stage, "unknown");
  model.dispose();
  await model.check();
  assert.equal(model.getSnapshot().stage, "ended");
  assert(f.raw());
});
test("unresolved strict-effect remount reauthorizes and never replays mutation", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  f.mode("timeout");
  await f.model.confirm();
  f.model.dispose();
  f.model.activate();
  await f.model.bootstrap();
  assert.equal(f.model.getSnapshot().stage, "unknown");
  assert.equal(f.counts().posts, 1);
});
test("provider/channel/unknown replay gates preserve retained intent; pause allows explicit same-key replay", async () => {
  for (const reason of ["PAYMENT_PROVIDER_UNAVAILABLE", "FUTURE_REASON"]) {
    const f = coordinatorFixture();
    await f.model.bootstrap();
    f.model.edit("123000");
    await f.model.review();
    f.mode("timeout");
    await f.model.confirm();
    f.policy(reason);
    await f.model.replay();
    assert.equal(f.counts().posts, 1);
    assert.equal(f.counts().keys, 1);
    assert(f.raw());
  }
  const paused = coordinatorFixture();
  await paused.model.bootstrap();
  paused.model.edit("123000");
  await paused.model.review();
  paused.mode("timeout");
  await paused.model.confirm();
  paused.policy("PAYMENT_CREATION_PAUSED");
  paused.mode("ok");
  await paused.model.replay();
  assert.equal(paused.counts().posts, 2);
  assert.equal(paused.counts().keys, 1);
});

test("actual shared HTTP 401 renewal never replays create", async () => {
  const { default: axios } = await import("axios");
  const { createHttpClient } = await import("../src/lib/http/client");
  let sends = 0,
    renewals = 0;
  const client = createHttpClient(
    () => "https://fixture.invalid/api/v1",
    axios.create({
      adapter: async (config) => {
        sends++;
        assert.equal(config.url, "/payments");
        assert.equal(config.headers["Idempotency-Key"], "same-key");
        return {
          config,
          status: 401,
          statusText: "",
          headers: {},
          data: { success: false, message: "INVALID_TOKEN" },
        };
      },
    }),
  );
  client.bindSession({
    generation: 1,
    getToken: async () => "synthetic",
    renew: async () => {
      renewals++;
    },
    expire: async () => {},
  });
  await assert.rejects(
    createPaymentApi(client).create(
      { paymentAmountVnd: "1000", gateway: "PAYOS" },
      "same-key",
      new AbortController().signal,
    ),
  );
  assert.equal(sends, 1);
  assert.equal(renewals, 1);
});

test("failed ID persistence retains PAID and known ID in RAM without allowing another create", async () => {
  const f = coordinatorFixture();
  let posts = 0;
  const model = createPaymentCoordinator({
    ...f.options,
    openStore: async () => ({
      ...f.store,
      bindId: async () => {
        throw new AppError("storage");
      },
    }),
    api: {
      ...f.options.api,
      create: async () => {
        posts++;
        return paymentWire("PAID", 2);
      },
    },
  });
  await model.bootstrap();
  model.edit("123000");
  await model.review();
  await model.confirm();
  assert.equal(model.getSnapshot().payment?.status, "PAID");
  assert.equal(model.getSnapshot().paymentId, paymentId);
  assert.match(model.getSnapshot().notice!, /Chưa lưu/);
  assert(f.raw());
  await model.confirm();
  await model.replay();
  assert.equal(posts, 1);
  await model.check();
  assert.equal(model.getSnapshot().payment?.status, "PAID");
  assert.match(model.getSnapshot().notice!, /Chưa lưu/);
});

test("known fresh-creation blocks do not prevent explicit identity-preserving replay", async () => {
  for (const reason of [
    "PAYMENT_CHANNEL_RECONCILIATION_REQUIRED",
    "PAYMENT_RECONCILIATION_REQUIRED",
    "PAYMENT_UNRESOLVED",
  ]) {
    const f = coordinatorFixture();
    await f.model.bootstrap();
    f.model.edit("123000");
    await f.model.review();
    f.mode("timeout");
    await f.model.confirm();
    f.policy(reason);
    f.mode("ok");
    await f.model.replay();
    assert.equal(f.counts().posts, 2);
    assert.equal(f.counts().keys, 1);
  }
});

test("another top-up requires verified resolved cleanup; pending and storage failure stay blocked", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  await f.model.confirm();
  assert.equal(f.model.getSnapshot().canStartNext, false);
  f.model.startNext();
  assert.equal(f.model.getSnapshot().stage, "known");
  await f.model.check();
  assert.equal(f.model.getSnapshot().canStartNext, true);
  f.model.startNext();
  assert.equal(f.model.getSnapshot().stage, "draft");
  const broken = coordinatorFixture();
  const model = createPaymentCoordinator({
    ...broken.options,
    openStore: async () => ({
      ...broken.store,
      resolve: async () => {
        throw new AppError("storage");
      },
    }),
  });
  await model.bootstrap();
  model.edit("123000");
  await model.review();
  await model.confirm();
  await model.check();
  assert.equal(model.getSnapshot().payment?.status, "PAID");
  assert.equal(model.getSnapshot().canStartNext, false);
  model.startNext();
  assert.equal(model.getSnapshot().stage, "known");
});

test("Strict effect disposal during bootstrap releases the obsolete lease before reactivation", async () => {
  const f = coordinatorFixture();
  let loads = 0,
    finish: () => void = () => {};
  const model = createPaymentCoordinator({
    ...f.options,
    openStore: async () => ({
      ...f.store,
      load: async () => {
        if (++loads === 1)
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        return null;
      },
    }),
  });
  const old = model.bootstrap();
  await new Promise((resolve) => setImmediate(resolve));
  model.dispose();
  model.activate();
  const fresh = model.bootstrap();
  assert.notEqual(fresh, old);
  await fresh;
  assert.equal(model.getSnapshot().stage, "draft");
  finish();
  await old;
  assert.equal(model.getSnapshot().stage, "draft");
  assert.equal(f.counts().posts, 0);
});

test("storage initialization can be explicitly retried without creating or losing a retained identity", async () => {
  const f = coordinatorFixture();
  let failed = true;
  const model = createPaymentCoordinator({
    ...f.options,
    openStore: async () => {
      if (failed) throw new AppError("storage");
      return f.store;
    },
  });
  await model.bootstrap();
  assert.equal(model.getSnapshot().canRestore, true);
  assert.equal(model.getSnapshot().canReturnToDraft, false);
  failed = false;
  await model.bootstrap();
  assert.equal(model.getSnapshot().stage, "draft");
  assert.equal(f.counts().posts, 0);
  model.supportStop();
  assert.equal(model.getSnapshot().canRestore, false);
});

test("automatic owner reads advance CREATED to QR then PAID without another create/key", async () => {
  const f = coordinatorFixture();
  let posts = 0,
    gets = 0,
    tick: (() => void) | undefined;
  const model = createPaymentCoordinator({
    ...f.options,
    api: {
      ...f.options.api,
      create: async () => {
        posts++;
        return paymentWire("CREATED", 1);
      },
      detail: async () =>
        paymentWire(++gets === 1 ? "PENDING" : "PAID", gets + 1),
    },
  });
  await model.bootstrap();
  model.edit("123000");
  await model.review();
  await model.confirm();
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({
      id: model.getSnapshot().paymentId,
      status: model.getSnapshot().payment?.status,
      denied: model.getSnapshot().readDenied,
    }),
    read: model.check,
    schedule: (fn) => {
      tick = fn;
      return () => {
        tick = undefined;
      };
    },
  });
  tick!();
  await new Promise((resolve) => setImmediate(resolve));
  assert(model.getSnapshot().payment?.checkout?.qrCode);
  tick!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(model.getSnapshot().payment?.status, "PAID");
  assert.equal(posts, 1);
  assert.equal(gets, 2);
  assert.equal(f.counts().keys, 1);
  assert.equal(tick, undefined);
  assert.equal(f.raw(), null);
});

test("owner denial stops scheduled GETs, evicts QR and retains the same durable request", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  await f.model.confirm();
  f.mode("404");
  await f.model.check();
  assert.equal(f.model.getSnapshot().readDenied, true);
  assert.equal(f.model.getSnapshot().payment, undefined);
  assert(f.raw());
  startPaymentReadLoop({
    current: () => true,
    snapshot: () => ({
      id: paymentId,
      denied: f.model.getSnapshot().readDenied,
    }),
    read: f.model.check,
    schedule: () => {
      assert.fail("denied owner must not be polled");
    },
  });
  assert.equal(f.counts().posts, 1);
});

test("an unknown retained key cannot be associated with a policy blocker by matching amount", async () => {
  const f = coordinatorFixture();
  await f.model.bootstrap();
  f.model.edit("123000");
  await f.model.review();
  f.mode("timeout");
  await f.model.confirm();
  f.policy("PAYMENT_UNRESOLVED");
  await f.model.check();
  await f.model.check();
  assert.equal(f.counts().gets, 0);
  assert.equal(f.model.getSnapshot().payment, undefined);
  assert.equal(f.model.getSnapshot().readTargetId, undefined);
  assert(f.raw());
});
