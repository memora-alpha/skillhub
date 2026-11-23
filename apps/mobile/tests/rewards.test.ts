import assert from "node:assert/strict";
import { test } from "node:test";
import { createRewardsApi } from "../src/features/rewards/api/rewards-api";
import type {
  Redemption,
  RedemptionIntent,
  RewardProduct,
} from "../src/features/rewards/api/reward-contracts";
import { RedemptionCoordinator } from "../src/features/rewards/utils/redemption-coordinator";
import type { RedemptionStore } from "../src/features/rewards/storage/redemption-store";
import {
  filterProducts,
  redemptionLabel,
  safeVoucherLink,
} from "../src/features/rewards/utils/reward-presentation";
import { AppError } from "../src/lib/http/errors";

const productId = "11111111-1111-4111-8111-111111111111";
const receiptId = "22222222-2222-4222-8222-222222222222";
const key = "33333333-3333-4333-8333-333333333333";
const product: RewardProduct = {
  id: productId,
  name: "Cà phê Demo 50.000đ",
  imageUrl: null,
  category: "Ăn uống",
  brand: { id: receiptId, name: "Cà phê Demo", logoUrl: null },
  faceValueVnd: "50000",
  priceCredit: "50.00",
  priceVersion: 2,
  terms: null,
  validityDays: null,
  status: "ACTIVE",
  sortOrder: 0,
};
const receipt: Redemption = {
  id: receiptId,
  product: {
    id: productId,
    name: product.name,
    imageUrl: null,
    brandName: product.brand.name,
    brandLogoUrl: null,
  },
  status: "ISSUING",
  priceCredit: "50.00",
  faceValueVnd: "50000",
  createdAt: "2026-11-22T16:00:00Z",
  resolvedAt: null,
  expiresAt: null,
};
const intent: RedemptionIntent = { key, productId, expectedPriceVersion: 2 };

function fixture() {
  let saved: RedemptionIntent | null = null;
  let current = true;
  let nextKey = key;
  const calls: RedemptionIntent[] = [];
  const lookups: RedemptionIntent[] = [];
  const events: string[] = [];
  let lookup: (
    input: RedemptionIntent,
  ) => Promise<Redemption | null> = async () => receipt;
  let send: (input: RedemptionIntent) => Promise<Redemption> = async () =>
    receipt;
  const store: RedemptionStore = {
    async read() {
      return saved;
    },
    async write(value) {
      events.push("write");
      saved = value;
    },
    async remove() {
      events.push("remove");
      saved = null;
    },
  };
  const create = () =>
    new RedemptionCoordinator({
      openStore: async () => store,
      createKey: () => nextKey,
      isCurrent: () => current,
      changed: () => {
        events.push("changed");
      },
      send: async (input) => {
        calls.push(input);
        events.push("send");
        return send(input);
      },
      lookup: async (input) => {
        lookups.push(input);
        events.push("lookup");
        return lookup(input);
      },
    });
  return {
    create,
    store,
    calls,
    lookups,
    events,
    get saved() {
      return saved;
    },
    setSaved(value: RedemptionIntent) {
      saved = value;
    },
    setSend(value: typeof send) {
      send = value;
    },
    setLookup(value: typeof lookup) {
      lookup = value;
    },
    setKey(value: string) {
      nextKey = value;
    },
    endSession() {
      current = false;
    },
  };
}

test("catalog uses the actual endpoint and rejects malformed or inactive products", async () => {
  const api = createRewardsApi(async (path, options) => {
    assert.equal(path, "/rewards/products?locale=vi");
    assert.ok(options?.signal);
    return [product];
  });
  assert.deepEqual(await api.products(new AbortController().signal), [product]);
  for (const row of [
    { ...product, status: "INACTIVE" },
    { ...product, priceCredit: "50.001" },
  ]) {
    await assert.rejects(
      createRewardsApi(async () => [row]).products(),
      (error: AppError) => error.kind === "protocol",
    );
  }
});
test("debit sends exactly the confirmed version and stable key and never caches secret fields", async () => {
  const api = createRewardsApi(async (path, options) => {
    assert.equal(path, "/rewards/redemptions");
    assert.equal(options?.method, "POST");
    assert.equal(options?.idempotencyKey, key);
    assert.equal(options?.replayAfterRenewal, false);
    assert.deepEqual(options?.body, { productId, expectedPriceVersion: 2 });
    return {
      ...receipt,
      voucher: { code: "PRIVATE", pin: "1234", link: null },
    };
  });
  assert.deepEqual(await api.redeem(intent), receipt);
});
test("wrong resource identities and secrets on unissued responses are rejected", async () => {
  await assert.rejects(
    createRewardsApi(async () => ({ ...product, id: receiptId })).product(
      productId,
    ),
  );
  await assert.rejects(
    createRewardsApi(async () => ({ ...receipt, id: productId })).receipt(
      receiptId,
    ),
  );
  await assert.rejects(
    createRewardsApi(async () => ({
      ...receipt,
      voucher: { code: "PRIVATE", pin: null, link: null },
    })).reveal(receiptId),
  );
});
test("receipt metadata strips secrets while explicit reveal returns the issued code", async () => {
  const row = {
    ...receipt,
    status: "ISSUED",
    voucher: { code: "DEMO-CODE", pin: null, link: null },
  };
  const api = createRewardsApi(async (_path, options) => {
    assert.equal(options?.replayAfterRenewal, false);
    return row;
  });
  assert.equal("voucher" in (await api.receipt(receiptId)), false);
  assert.equal((await api.reveal(receiptId)).voucher?.code, "DEMO-CODE");
});
test("history preserves server pagination and never keeps voucher secrets", async () => {
  const api = createRewardsApi(async (path, options) => {
    assert.ok(path.includes("cursor=next"));
    assert.equal(options?.includeMeta, true);
    return {
      data: [{ ...receipt, voucher: { code: "PRIVATE" } }],
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: "later" } },
    };
  });
  const page = await api.redemptions("next");
  assert.equal(page.nextCursor, "later");
  assert.deepEqual(page.items, [receipt]);
});
test("search handles Vietnamese accents and combines search with category", () => {
  assert.equal(filterProducts([product], "ca phe", "Ăn uống").length, 1);
  assert.equal(filterProducts([product], "ca phe", "Mua sắm").length, 0);
  assert.equal(filterProducts([product], "missing", "").length, 0);
});

test("search matches uppercase and lowercase Vietnamese D with and without accents", () => {
  const row = {
    ...product,
    name: "Đồng hành",
    brand: { ...product.brand, name: "Đối tác" },
  };
  for (const search of [
    "dong",
    "đồng",
    "Đồng",
    "ĐỒNG",
    "doi tac",
    "đối tác",
    "ĐỐI TÁC",
  ])
    assert.deepEqual(filterProducts([row], search, "Ăn uống"), [row]);
  assert.deepEqual(filterProducts([row], "dong", "Mua sắm"), []);
});
test("voucher links reject executable URLs, HTTP and embedded credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:secret@example.com",
    "not a URL",
    null,
  ])
    assert.equal(safeVoucherLink(value), null);
  assert.equal(
    safeVoucherLink("https://example.com/voucher"),
    "https://example.com/voucher",
  );
});
test("expiry is presentation only and does not invent a USED status", () => {
  assert.equal(
    redemptionLabel(
      { status: "ISSUED", expiresAt: "2026-01-01T00:00:00Z" },
      Date.parse("2026-02-01T00:00:00Z"),
    ),
    "Đã hết hạn",
  );
  assert.equal(
    redemptionLabel({ status: "ISSUED", expiresAt: null }),
    "Đã phát hành",
  );
});
test("save occurs before POST and a confirmed result refreshes reads without local wallet arithmetic", async () => {
  const f = fixture();
  const model = f.create();
  await model.load();
  assert.deepEqual(await model.redeem(product), receipt);
  assert.deepEqual(f.events, ["write", "send", "changed", "remove"]);
  assert.equal(f.saved, null);
  assert.equal(model.getSnapshot().stage, "ready");
});
test("concurrent taps send one request", async () => {
  const f = fixture();
  let finish!: (row: Redemption) => void;
  f.setSend(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const model = f.create();
  await model.load();
  const first = model.redeem(product);
  await Promise.resolve();
  assert.equal(await model.redeem(product), undefined);
  finish(receipt);
  await first;
  assert.equal(f.calls.length, 1);
});
test("unknown outcomes survive reconstruction and use lookup without sending another debit", async () => {
  const f = fixture();
  f.setSend(async () => {
    throw new AppError("network");
  });
  const first = f.create();
  await first.load();
  await first.redeem(product);
  assert.equal(first.getSnapshot().stage, "uncertain");
  const reopened = f.create();
  await reopened.load();
  assert.equal(f.calls.length, 1); // hydration never replays a mutation
  assert.equal(
    await reopened.redeem({ ...product, priceVersion: 3 }),
    undefined,
  );
  assert.deepEqual(await reopened.recover(), receipt);
  assert.deepEqual(f.calls, [intent]);
  assert.deepEqual(f.lookups, [intent]);
  assert.equal(f.saved, null);
});
test("definite initial rejection clears intent but a failed lookup preserves it", async () => {
  const f = fixture();
  f.setSend(async () => {
    throw new AppError("http", 409, "REWARD_PRICE_CHANGED");
  });
  const first = f.create();
  await first.load();
  await first.redeem(product);
  assert.equal(first.getSnapshot().stage, "ready");
  assert.equal(f.saved, null);
  f.setSaved(intent);
  const recovered = f.create();
  await recovered.load();
  f.setLookup(async () => {
    throw new AppError("network");
  });
  await recovered.recover();
  assert.equal(recovered.getSnapshot().stage, "uncertain");
  assert.deepEqual(f.saved, intent);
});

test("lookup uses POST with the original key, no debit body or session replay, and strips secrets", async () => {
  const api = createRewardsApi(async (path, options) => {
    assert.equal(path, "/rewards/redemptions/lookup");
    assert.equal(options?.method, "POST");
    assert.equal(options?.idempotencyKey, key);
    assert.equal(options?.body, undefined);
    assert.equal(options?.replayAfterRenewal, false);
    return {
      ...receipt,
      voucher: { code: "PRIVATE", pin: "1234", link: null },
    };
  });
  assert.deepEqual(await api.lookup(intent), receipt);
  await assert.rejects(
    createRewardsApi(async () => ({
      ...receipt,
      product: { ...receipt.product, id: receiptId },
    })).lookup(intent),
    (error: AppError) => error.kind === "protocol",
  );
  let calls = 0;
  await assert.rejects(
    createRewardsApi(async () => {
      calls++;
    }).lookup({ ...intent, key: "invalid" }),
  );
  assert.equal(calls, 0);
});

test("only the lookup endpoint's exact retired-key 404 means no redemption", async () => {
  const rejected = (error: AppError) =>
    createRewardsApi(async () => {
      throw error;
    });
  assert.equal(
    await rejected(
      new AppError("http", 404, "VOUCHER_REDEMPTION_NOT_FOUND"),
    ).lookup(intent),
    null,
  );
  for (const error of [
    new AppError("http", 404, "NOT_FOUND"),
    new AppError("http", 403, "VOUCHER_REDEMPTION_NOT_FOUND"),
    new AppError("http", 401),
    new AppError("http", 500),
    new AppError("network"),
  ]) {
    await assert.rejects(
      rejected(error).lookup(intent),
      (cause) => cause === error,
    );
  }
});

test("crash before POST and a stale price can recover without debit and require a fresh confirmed key", async () => {
  const f = fixture();
  f.setSaved(intent);
  f.setLookup(async () => null); // BE retired the unused key.
  const model = f.create();
  await model.load();
  assert.equal(f.calls.length, 0);
  await model.recover();
  assert.equal(f.calls.length, 0);
  assert.equal(f.saved, null);
  assert.equal(model.getSnapshot().stage, "ready");
  assert.equal(model.getSnapshot().notice, "not-redeemed");
  assert.deepEqual(f.events, ["lookup", "changed", "remove"]);
  const freshKey = "44444444-4444-4444-8444-444444444444";
  f.setKey(freshKey);
  await model.redeem({ ...product, priceVersion: 3 });
  assert.deepEqual(f.calls, [
    { key: freshKey, productId, expectedPriceVersion: 3 },
  ]);
  assert.equal(model.getSnapshot().notice, undefined);
});

test("pending lookup blocks repeat checks and new redemptions until its outcome", async () => {
  const f = fixture();
  f.setSaved(intent);
  let finish!: (row: Redemption) => void;
  f.setLookup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const model = f.create();
  await model.load();
  const pending = model.recover();
  assert.equal(model.getSnapshot().stage, "pending");
  assert.equal(await model.recover(), undefined);
  assert.equal(await model.redeem(product), undefined);
  assert.equal(f.lookups.length, 1);
  assert.equal(f.calls.length, 0);
  finish(receipt);
  assert.deepEqual(await pending, receipt);
});

test("lookup errors never clear the saved request or unlock a new debit", async () => {
  for (const error of [
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 500),
    new AppError("http", 401),
    new AppError("http", 403),
    new AppError("http", 404, "NOT_FOUND"),
    new AppError("http", 409, "REWARD_PRICE_CHANGED"),
  ]) {
    const f = fixture();
    f.setSaved(intent);
    f.setLookup(async () => {
      throw error;
    });
    const model = f.create();
    await model.load();
    await model.recover();
    assert.equal(model.getSnapshot().stage, "uncertain");
    assert.deepEqual(f.saved, intent);
    assert.equal(await model.redeem(product), undefined);
    assert.deepEqual(f.events, ["lookup"]);
  }
});

test("failed cleanup after either lookup outcome preserves recovery until removal succeeds", async () => {
  for (const outcome of [receipt, null]) {
    const f = fixture();
    f.setSaved(intent);
    f.setLookup(async () => outcome);
    const remove = f.store.remove;
    f.store.remove = async () => {
      throw new Error("remove failed");
    };
    const model = f.create();
    await model.load();
    await model.recover();
    assert.equal(model.getSnapshot().stage, "uncertain");
    assert.deepEqual(f.saved, intent);
    f.store.remove = remove;
    await model.recover();
    assert.equal(model.getSnapshot().stage, "ready");
    assert.equal(f.saved, null);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.lookups, [intent, intent]);
  }
});

test("late lookup outcomes from an ended session cannot refresh, clear or navigate", async () => {
  for (const outcome of [receipt, null]) {
    const f = fixture();
    f.setSaved(intent);
    f.setLookup(async () => {
      f.endSession();
      return outcome;
    });
    const model = f.create();
    await model.load();
    assert.equal(await model.recover(), undefined);
    assert.deepEqual(f.events, ["lookup"]);
    assert.deepEqual(f.saved, intent);
  }
});
test("failed durable write prevents POST", async () => {
  const f = fixture();
  f.store.write = async () => {
    throw new Error("unavailable");
  };
  const model = f.create();
  await model.load();
  await model.redeem(product);
  assert.equal(f.calls.length, 0);
  assert.equal(model.getSnapshot().stage, "unavailable");
});
test("failed cleanup retains intent instead of permitting a new debit", async () => {
  const f = fixture();
  f.store.remove = async () => {
    throw new Error("remove failed");
  };
  const model = f.create();
  await model.load();
  await model.redeem(product);
  assert.equal(model.getSnapshot().stage, "uncertain");
  assert.deepEqual(f.saved, intent);
  assert.equal(await model.redeem(product), undefined);
  assert.equal(f.calls.length, 1);
});
test("a session ending during the save cannot send a debit", async () => {
  const f = fixture();
  f.store.write = async () => {
    f.endSession();
  };
  const model = f.create();
  await model.load();
  await model.redeem(product);
  assert.equal(f.calls.length, 0);
});
test("a late response from a previous session cannot refresh or clean a new session", async () => {
  const f = fixture();
  f.setSend(async () => {
    f.endSession();
    return receipt;
  });
  const model = f.create();
  await model.load();
  assert.equal(await model.redeem(product), undefined);
  assert.deepEqual(f.events, ["write", "send"]);
  assert.deepEqual(f.saved, intent);
});
