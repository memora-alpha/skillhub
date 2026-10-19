import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { accountWalletCapabilities } from "../src/features/wallet/context/account-capabilities";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import { focusPaymentCreate } from "../src/features/wallet/context/payment-create-session";
import { explicitPaymentNavigation } from "../src/features/wallet/utils/payment-route-action";

test("ordinary native payment uses durable creation; web only enables independent owner reads", () => {
  for (const platform of ["ios", "android"]) {
    const caps = accountWalletCapabilities(platform);
    assert(caps.createPayment && caps.recovery && caps.paymentStatus);
    assert.equal(caps.quote, false);
  }
  assert.equal(accountWalletCapabilities("web").createPayment, false);
  assert.equal(accountWalletCapabilities("web").recovery, false);
  assert.equal(accountWalletCapabilities("web").paymentStatus, true);
  assert.equal(noWalletCapabilities.createPayment, false);
});

test("focus handoff cannot let an old route blur pause the new route; Strict cleanup re-registers", () => {
  const runtime = createWalletRuntime({
    scope: { ownerId: "A", generation: 1 },
    queries: new QueryClient(),
    current: () => true,
  });
  let paused = 0,
    activated = 0,
    disposed = 0;
  const model = {
    activate: () => activated++,
    pause: () => paused++,
    dispose: () => disposed++,
  };
  const a = focusPaymentCreate(runtime, "fixture", model);
  const b = focusPaymentCreate(runtime, "fixture", model);
  assert.equal(a.current(), false);
  assert.equal(b.current(), true);
  a.release();
  assert.equal(paused, 0);
  b.release();
  assert.equal(paused, 1);
  runtime.dispose();
  assert.equal(disposed, 1);
  runtime.activate();
  const c = focusPaymentCreate(runtime, "fixture", model);
  assert.equal(runtime.sessionData.get("payment-create:fixture"), model);
  assert(c.current());
  runtime.dispose();
  assert.equal(disposed, 2);
  assert.equal(activated, 3);
});

test("explicit confirmation coalesces navigation and never navigates after blur/session retirement", async () => {
  let finish: () => void = () => {};
  let calls = 0,
    navigations = 0,
    current = true;
  const action = explicitPaymentNavigation({
    current: () => current,
    epoch: () => 1,
    outcome: () => "known",
    navigate: () => navigations++,
  });
  const work = () => {
    calls++;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  const a = action(work),
    b = action(work);
  assert.equal(calls, 1);
  finish();
  await Promise.all([a, b]);
  assert.equal(navigations, 1);
  const retired = action(work);
  current = false;
  finish();
  await retired;
  assert.equal(navigations, 1);
  await action(work);
  assert.equal(calls, 2);
});

test("draft/review/blocked outcomes never navigate as successful creation", async () => {
  for (const stage of ["draft", "review", "blocked", "ended"]) {
    let navigations = 0;
    await explicitPaymentNavigation({
      current: () => true,
      epoch: () => 1,
      outcome: () => stage,
      navigate: () => navigations++,
    })(async () => {});
    assert.equal(navigations, 0);
  }
});

test("leaving then re-entering the same route cannot navigate from its old action", async () => {
  let epoch = {},
    navigate = 0,
    finish: () => void = () => {};
  const action = explicitPaymentNavigation({
    current: () => true,
    epoch: () => epoch,
    outcome: () => "known",
    navigate: () => navigate++,
  });
  const old = action(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  epoch = {};
  finish();
  await old;
  assert.equal(navigate, 0);
});
