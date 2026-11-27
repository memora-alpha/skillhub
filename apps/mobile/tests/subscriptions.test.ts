import assert from "node:assert/strict";
import { test } from "node:test";
import { createSubscriptionsApi } from "../src/features/subscriptions/api/subscriptions-api";
import { SubscriptionCoordinator } from "../src/features/subscriptions/utils/subscription-coordinator";
import {
  confirmationChanged,
  type SubscriptionConfirmation,
} from "../src/features/subscriptions/utils/subscription-confirmation";
import {
  creditLabel,
  planAction,
  storageLabel,
  usagePercent,
} from "../src/features/subscriptions/utils/subscription-presentation";
import { AppError } from "../src/lib/http/errors";
import { requestDiagnostics } from "../src/lib/http/request-diagnostics";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import { parseHistoryFilters } from "../src/features/wallet/schemas/transaction-contracts";
import {
  transactionLabel,
  referenceLabel,
} from "../src/features/wallet/utils/transaction-labels";
import type {
  Membership,
  SubscriptionIntent,
} from "../src/features/subscriptions/api/subscription-contracts";
import type { SubscriptionStore } from "../src/features/subscriptions/storage/subscription-store";
import {
  creator,
  pro,
  freeMembership,
  paidMembership,
  purchaseIntent,
  proId,
} from "./fixtures/subscriptions";

function fixture() {
  let saved: SubscriptionIntent | null = null;
  let current = true;
  let writeFails = false;
  let removeFails = false;
  const events: string[] = [];
  const calls: SubscriptionIntent[] = [];
  let send: (intent: SubscriptionIntent) => Promise<Membership> = async () =>
    paidMembership;
  const store: SubscriptionStore = {
    read: async () => saved,
    write: async (intent) => {
      events.push("write");
      if (writeFails) throw new Error("storage");
      saved = intent;
    },
    remove: async () => {
      events.push("remove");
      if (removeFails) throw new Error("storage");
      saved = null;
    },
  };
  const create = () =>
    new SubscriptionCoordinator({
      openStore: async () => store,
      createKey: () => purchaseIntent.key,
      isCurrent: () => current,
      changed: () => {
        events.push("changed");
      },
      send: async (intent) => {
        events.push("send");
        calls.push(intent);
        return send(intent);
      },
    });
  return {
    create,
    calls,
    events,
    get saved() {
      return saved;
    },
    setSend(value: typeof send) {
      send = value;
    },
    endSession() {
      current = false;
    },
    failWrite() {
      writeFails = true;
    },
    failRemove(value = true) {
      removeFails = value;
    },
  };
}

test("catalog rejects unknown plans, malformed money and duplicate versions", async () => {
  assert.deepEqual(
    await createSubscriptionsApi(async () => [creator, pro]).plans(),
    [creator, pro],
  );
  for (const rows of [
    [{ ...creator, planCode: "PLUS" }],
    [{ ...creator, monthPrice: 99 }],
    [creator, creator],
  ]) {
    await assert.rejects(createSubscriptionsApi(async () => rows).plans(), {
      kind: "protocol",
    });
  }
});
test("membership parses Free, active, grace and quota above the allowance without inventing a plan", async () => {
  for (const value of [
    freeMembership,
    paidMembership,
    {
      ...paidMembership,
      subscription: {
        ...paidMembership.subscription,
        status: "GRACE",
        graceUntil: "2026-12-30T00:00:00Z",
      },
      materialStorage: {
        usedBytes: "11000000000",
        allowedBytes: "10000000000",
        enforced: true,
      },
    },
  ]) {
    assert.deepEqual(
      await createSubscriptionsApi(async () => value).me(),
      value,
    );
  }
  await assert.rejects(
    createSubscriptionsApi(async () => ({
      ...freeMembership,
      materialStorage: { usedBytes: 42 },
    })).me(),
    { kind: "protocol" },
  );
});
test("purchase sends only confirmed fields and the stable key with auth replay disabled", async () => {
  let requests = 0;
  const api = createSubscriptionsApi(async (path, options) => {
    requests++;
    assert.equal(path, "/me/subscription");
    assert.equal(options?.method, "POST");
    assert.equal(options?.idempotencyKey, purchaseIntent.key);
    assert.equal(options?.replayAfterRenewal, false);
    assert.deepEqual(options?.body, purchaseIntent.command.body);
    return paidMembership;
  });
  await api.send(purchaseIntent);
  assert.equal(requests, 1);
});
test("a malformed payment response is reported as protocol failure without claiming an HTTP 500", async (t) => {
  const reports: {
    path: string;
    method: string;
    error: unknown;
    source: string;
  }[] = [];
  t.mock.method(
    requestDiagnostics,
    "failed",
    (path: string, method: string, error: unknown, source: string) => {
      reports.push({ path, method, error, source });
    },
  );
  await assert.rejects(
    createSubscriptionsApi(async () => ({ subscription: null })).send(
      purchaseIntent,
    ),
    { kind: "protocol" },
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.path, "/me/subscription");
  assert.equal(reports[0]?.method, "POST");
  assert.equal(reports[0]?.source, "server");
  assert.ok(reports[0]?.error instanceof AppError);
  assert.equal(reports[0].error.status, 0);
});
test("upgrade uses the server quote amount/version and PATCH preserves null vs omitted", async () => {
  const quote = {
    planCode: "PRO",
    planVersionId: proId,
    amount: "133.33",
    termEnd: "2026-12-27T00:00:00Z",
    quotedAt: "2026-12-07T00:00:00Z",
    version: 3,
  };
  const paths: string[] = [];
  const api = createSubscriptionsApi(async (path, options) => {
    paths.push(path);
    if (path.includes("upgrade-quote")) return quote;
    if (path.endsWith("upgrade"))
      assert.deepEqual(options?.body, {
        planCode: "PRO",
        expectedPlanVersionId: proId,
        expectedAmount: "133.33",
        expectedVersion: 3,
      });
    else {
      assert.deepEqual(options?.body, {
        expectedVersion: 3,
        scheduledPlanCode: null,
      });
      assert.equal(options?.replayAfterRenewal, false);
    }
    return paidMembership;
  });
  await api.quote("PRO");
  await api.send({
    key: purchaseIntent.key,
    command: {
      kind: "upgrade",
      amount: quote.amount,
      body: {
        planCode: "PRO",
        expectedPlanVersionId: proId,
        expectedAmount: quote.amount,
        expectedVersion: quote.version,
      },
    },
  });
  await api.update({ expectedVersion: 3, scheduledPlanCode: null });
  assert.equal(paths.length, 3);
  await assert.rejects(
    createSubscriptionsApi(async () => ({
      ...quote,
      planCode: "CREATOR",
    })).quote("PRO"),
    { kind: "protocol" },
  );
});
test("charges keep server pagination and support all charge kinds", async () => {
  const data = ["PURCHASE", "UPGRADE", "RENEWAL", "RECORDING_ADDON"].map(
    (kind) => ({
      id: proId,
      kind,
      planCode: "PRO",
      amount: "30.00",
      quantity: 1,
      createdAt: "2026-11-27T00:00:00Z",
    }),
  );
  const page = await createSubscriptionsApi(async (path, options) => {
    assert.equal(path, "/me/subscription/charges?limit=20&cursor=next");
    assert.equal(options?.includeMeta, true);
    return {
      data,
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: "other" } },
    };
  }).charges("next");
  assert.deepEqual(page.items, data);
  assert.equal(page.nextCursor, "other");
});
test("save precedes debit, successful cleanup refreshes authoritative reads", async () => {
  const f = fixture(),
    model = f.create();
  await model.load();
  await model.execute(purchaseIntent.command);
  assert.deepEqual(f.events, ["write", "send", "changed", "remove"]);
  assert.equal(f.saved, null);
  assert.equal(model.getSnapshot().completed, true);
});
test("double taps send one debit; initialization never replays saved commands", async () => {
  const f = fixture(),
    model = f.create();
  let finish!: (value: Membership) => void;
  f.setSend(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await model.load();
  const first = model.execute(purchaseIntent.command);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await model.execute(purchaseIntent.command);
  assert.equal(f.calls.length, 1);
  const recreated = f.create();
  await recreated.load();
  assert.equal(recreated.getSnapshot().stage, "uncertain");
  assert.equal(f.calls.length, 1);
  finish(paidMembership);
  await first;
});
test("uncertain responses survive reconstruction; explicit recovery sends exactly the old command/key", async () => {
  const f = fixture(),
    model = f.create();
  f.setSend(async () => {
    throw new AppError("network");
  });
  await model.load();
  await model.execute(purchaseIntent.command);
  assert.equal(model.getSnapshot().stage, "uncertain");
  await model.execute({ ...purchaseIntent.command, amount: "299.00" });
  assert.equal(f.calls.length, 1);
  const next = f.create();
  await next.load();
  f.setSend(async () => paidMembership);
  await next.resume();
  assert.deepEqual(f.calls, [purchaseIntent, purchaseIntent]);
  assert.equal(next.getSnapshot().stage, "ready");
});
test("domain rejections permit a newly confirmed request, auth/protocol/5xx preserve recovery", async () => {
  for (const error of [
    new AppError("http", 403, "SUBSCRIPTIONS_DISABLED"),
    new AppError("http", 409, "INSUFFICIENT_AVAILABLE_CREDIT"),
    new AppError("http", 409, "SUBSCRIPTION_QUOTE_CHANGED"),
  ]) {
    const f = fixture(),
      model = f.create();
    f.setSend(async () => {
      throw error;
    });
    await model.load();
    await model.execute(purchaseIntent.command);
    assert.equal(model.getSnapshot().stage, "ready");
    assert.equal(model.getSnapshot().error, error);
    assert.equal(f.calls.length, 1);
    assert.equal(f.saved, null);
  }
  for (const error of [
    new AppError("http", 401),
    new AppError("http", 403, "SUBSCRIPTION_PERMISSION_REQUIRED"),
    new AppError("protocol"),
    new AppError("http", 503),
    new AppError("http", 409, "IDEMPOTENCY_KEY_REUSED"),
  ]) {
    const f = fixture(),
      model = f.create();
    f.setSend(async () => {
      throw error;
    });
    await model.load();
    await model.execute(purchaseIntent.command);
    assert.equal(model.getSnapshot().stage, "uncertain");
    assert.deepEqual(f.saved, purchaseIntent);
  }
});
test("failed storage write prevents debit; failed cleanup keeps the completed command recoverable", async () => {
  const f = fixture(),
    model = f.create();
  f.failWrite();
  await model.load();
  await model.execute(purchaseIntent.command);
  assert.equal(f.calls.length, 0);
  assert.equal(model.getSnapshot().stage, "unavailable");
  const g = fixture(),
    next = g.create();
  g.failRemove();
  await next.load();
  await next.execute(purchaseIntent.command);
  assert.equal(next.getSnapshot().stage, "uncertain");
  assert.deepEqual(g.saved, purchaseIntent);
  g.failRemove(false);
  await next.resume();
  assert.equal(g.saved, null);
  assert.deepEqual(g.calls[0], g.calls[1]);
});
test("session end during save or response cannot dispatch or refresh another owner", async () => {
  const f = fixture(),
    model = f.create();
  await model.load();
  f.endSession();
  await model.execute(purchaseIntent.command);
  assert.equal(f.calls.length, 0);
  const g = fixture(),
    next = g.create();
  g.setSend(async () => {
    g.endSession();
    return paidMembership;
  });
  await next.load();
  await next.execute(purchaseIntent.command);
  assert.deepEqual(g.events, ["write", "send"]);
  assert.deepEqual(g.saved, purchaseIntent);
});
test("confirmations expire on price, plan version, subscription or settings version change", () => {
  const confirmation: SubscriptionConfirmation = {
    kind: "charge",
    title: "",
    description: "",
    expectedVersion: null,
    expectedSubscriptionId: null,
    command: purchaseIntent.command,
  };
  assert.equal(
    confirmationChanged(confirmation, freeMembership, [creator]),
    false,
  );
  assert.equal(
    confirmationChanged(confirmation, freeMembership, [
      { ...creator, monthPrice: "100.00" },
    ]),
    true,
  );
  assert.equal(
    confirmationChanged(confirmation, freeMembership, [
      { ...creator, planVersionId: proId },
    ]),
    true,
  );
  assert.equal(
    confirmationChanged(confirmation, paidMembership, [creator]),
    true,
  );
  assert.equal(
    confirmationChanged(
      {
        kind: "update",
        title: "",
        description: "",
        expectedSubscriptionId: paidMembership.subscription!.id,
        body: { expectedVersion: 2, autoRenew: false },
      },
      paidMembership,
    ),
    true,
  );
});
test("plan decisions respect immediate upgrades vs renewal changes and grace", () => {
  assert.equal(planAction(creator, "MONTH", null), "purchase");
  assert.equal(
    planAction(creator, "MONTH", paidMembership.subscription),
    "current",
  );
  assert.equal(
    planAction(creator, "YEAR", paidMembership.subscription),
    "schedule",
  );
  assert.equal(
    planAction(pro, "MONTH", paidMembership.subscription),
    "upgrade",
  );
  assert.equal(
    planAction(pro, "YEAR", paidMembership.subscription),
    "unavailable",
  );
  assert.equal(
    planAction(creator, "MONTH", {
      ...paidMembership.subscription!,
      planCode: "PRO",
    }),
    "schedule",
  );
  assert.equal(
    planAction(pro, "MONTH", {
      ...paidMembership.subscription!,
      status: "GRACE",
    }),
    "unavailable",
  );
});
test("a replacement subscription with the same version invalidates an open confirmation", () => {
  const current = paidMembership.subscription!;
  const replacement = {
    ...paidMembership,
    subscription: { ...current, id: proId },
  };
  for (const confirmation of [
    {
      kind: "update" as const,
      title: "",
      description: "",
      expectedSubscriptionId: current.id,
      body: { expectedVersion: current.version, autoRenew: false },
    },
    {
      kind: "charge" as const,
      title: "",
      description: "",
      expectedSubscriptionId: current.id,
      expectedVersion: current.version,
      command: {
        kind: "upgrade" as const,
        amount: "1.00",
        body: {
          planCode: "PRO" as const,
          expectedPlanVersionId: proId,
          expectedAmount: "1.00",
          expectedVersion: current.version,
        },
      },
    },
  ]) {
    assert.equal(
      confirmationChanged(confirmation, paidMembership, [creator, pro]),
      false,
    );
    assert.equal(
      confirmationChanged(confirmation, replacement, [creator, pro]),
      true,
    );
  }
});
test("money and bytes retain exact large values; quota progress is bounded", () => {
  assert.equal(creditLabel("2870.50"), "2.870,50 Credit");
  assert.equal(storageLabel("50000000000"), "50 GB");
  assert.equal(storageLabel("420000000"), "420 MB");
  assert.equal(usagePercent("9999999999999999", "1000000000"), 100);
  assert.equal(usagePercent("0", "0"), 0);
});

test("subscription notifications open membership and wallet filters accept the actual ledger codes", () => {
  for (const type of [
    "subscription.renewed",
    "subscription.grace-started",
    "subscription.expired",
  ]) {
    assert.equal(
      notificationTarget({
        id: proId,
        type,
        title: "",
        body: "",
        payload: { subscriptionId: proId },
        createdAt: "2026-11-27T00:00:00Z",
        readAt: null,
      }),
      "/membership",
    );
  }
  assert.deepEqual(
    parseHistoryFilters({
      type: "SUBSCRIPTION_PURCHASE",
      referenceType: "SUBSCRIPTION_CHARGE",
    }),
    { type: "SUBSCRIPTION_PURCHASE", referenceType: "SUBSCRIPTION_CHARGE" },
  );
  assert.equal(
    transactionLabel("SUBSCRIPTION_PURCHASE"),
    "Thanh toán gói thành viên",
  );
  assert.equal(referenceLabel("SUBSCRIPTION_CHARGE"), "Gói thành viên");
});
