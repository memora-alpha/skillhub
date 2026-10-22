import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import type { RequestOptions } from "../src/lib/http/client";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import { createOwnerPaymentRefresh } from "../src/features/wallet/utils/payment-related-reads";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import {
  walletReadOptions,
  projectWalletRead,
} from "../src/features/wallet/utils/wallet-query";
import { paymentWire } from "./fixtures/payment-api";
import { deferred } from "./fixtures/payment-observation-model";
import { walletModels, ledgerModel } from "./fixtures/wallet-model";
import {
  historyOptions,
  historyItems,
} from "../src/features/wallet/utils/history-query";
import type { HistoryData } from "../src/features/wallet/types/transaction";

test("PAID refresh replaces reads started before payment and rejects their late results", async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const runtime = createWalletRuntime({
    scope: { ownerId: "a", generation: 1 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, wallet: true, history: true },
  });
  const oldWallet = deferred<unknown>();
  const oldHistory = deferred<{
    data: unknown[];
    pagination: { limit: number; hasMore: boolean; nextCursor: null };
  }>();
  const freshWallet = {
    ...walletModels.a,
    availableCredit: "246.45",
    walletVersion: 8,
  };
  let walletCalls = 0,
    historyCalls = 0;
  const client = {
    request: async () =>
      ++walletCalls === 1 ? oldWallet.promise : freshWallet,
    requestPage: async () =>
      ++historyCalls === 1
        ? oldHistory.promise
        : {
            data: [ledgerModel(1)],
            pagination: { limit: 20, hasMore: false, nextCursor: null },
          },
  };
  const wallet = walletReadOptions(runtime, client);
  const history = historyOptions(runtime, client, queries, {}, 0);
  const beforeWallet = queries.fetchQuery(wallet).catch(() => undefined);
  const beforeHistory = queries
    .fetchInfiniteQuery(history)
    .catch(() => undefined);
  const refresh = createOwnerPaymentRefresh(
    runtime,
    queries,
    client,
    parsePayment(paymentWire("PAID", 2)),
  );
  try {
    const after = refresh.refresh();
    // Release an uncooperative pre-payment transport after the refresh starts.
    oldWallet.resolve(walletModels.a);
    oldHistory.resolve({
      data: [],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    });
    await Promise.all([beforeWallet, beforeHistory, after]);
    assert.equal(walletCalls, 2, "Wallet must be read after PAID");
    assert.equal(historyCalls, 2, "History must be read after PAID");
    assert.deepEqual(queries.getQueryData(wallet.queryKey), {
      kind: "snapshot",
      snapshot: freshWallet,
    });
    assert.equal(
      historyItems(queries.getQueryData<HistoryData>(history.queryKey)?.pages)
        .length,
      1,
    );
    assert.equal(refresh.getSnapshot().wallet.status, "success");
    assert.equal(refresh.getSnapshot().history.status, "success");
  } finally {
    refresh.dispose();
    runtime.dispose();
    queries.clear();
  }
});

test("accepted PAID refreshes shared Wallet/history reads independently; retry sends only GETs", async () => {
  for (const failures of [
    [true, false],
    [false, true],
    [true, true],
  ]) {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const runtime = createWalletRuntime({
      scope: { ownerId: "a", generation: 1 },
      queries,
      current: () => true,
      capabilities: { ...noWalletCapabilities, wallet: true, history: true },
    });
    const calls: { path: string; options?: RequestOptions }[] = [];
    let failWallet = failures[0],
      failHistory = failures[1];
    const client = {
      request: async (path: string, options?: RequestOptions) => {
        calls.push({ path, options });
        if (failWallet) throw new AppError("network");
        return walletModels.a;
      },
      requestPage: async (path: string, options?: RequestOptions) => {
        calls.push({ path, options });
        if (failHistory) throw new AppError("network");
        return {
          data: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null },
        };
      },
    };
    const payment = parsePayment({
        ...paymentWire("PAID", 2),
        recoveryRequired: true,
        recoveryReason: "PAYMENT_CHECKOUT_MISSING",
      }),
      refresh = createOwnerPaymentRefresh(runtime, queries, client, payment);
    try {
      await refresh.refresh();
      const state = refresh.getSnapshot();
      assert.equal(state.payment?.state, "PAID");
      assert.equal(state.wallet.status, failWallet ? "error" : "success");
      assert.equal(state.history.status, failHistory ? "error" : "success");
      failWallet = false;
      failHistory = false;
      await refresh.refresh("wallet");
      await refresh.refresh("history");
      assert.equal(refresh.getSnapshot().payment?.state, "PAID");
      const options = walletReadOptions(runtime, client),
        data = queries.getQueryData(options.queryKey);
      assert.deepEqual(
        projectWalletRead(runtime, { data, error: null, isFetching: false })
          .data,
        walletModels.a,
      );
      assert(
        calls.every(
          (c) =>
            c.options?.method === "GET" &&
            c.options.authenticated &&
            c.options.signal,
        ),
      );
      assert(
        calls.every((c) => !c.path.includes("/payments") && !c.options?.body),
      );
      assert(
        calls
          .filter((c) => c.path.includes("transactions"))
          .every(
            (c) =>
              new URL(c.path, "http://127.0.0.1").searchParams.get("limit") ===
              "20",
          ),
      );
    } finally {
      refresh.dispose();
      runtime.dispose();
      queries.clear();
    }
  }
});
test("refresh coalesces by resource; cancelled old-session data cannot enter shared cache", async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let current = true,
    sends = 0;
  const runtime = createWalletRuntime({
    scope: { ownerId: "a", generation: 1 },
    queries,
    current: () => current,
    capabilities: { ...noWalletCapabilities, wallet: true, history: true },
  });
  const late = deferred<unknown>();
  let captured: AbortSignal | undefined;
  const client = {
    request: async (_p: string, o?: RequestOptions) => {
      sends++;
      captured = o?.signal;
      return late.promise;
    },
    requestPage: async () => ({
      data: [],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    }),
  };
  const refresh = createOwnerPaymentRefresh(
    runtime,
    queries,
    client,
    parsePayment(paymentWire("PAID")),
  );
  const first = refresh.refresh("wallet"),
    second = refresh.refresh("wallet");
  assert.equal(first, second);
  assert.equal(sends, 1);
  current = false;
  runtime.dispose();
  refresh.dispose();
  assert(captured?.aborted);
  late.resolve(walletModels.a);
  await first;
  assert.equal(refresh.getSnapshot().payment, undefined);
  assert.equal(queries.getQueryCache().getAll().length, 0);
  queries.clear();
});
test("non-PAID and unavailable dependent capability do not fetch or invent success", async () => {
  const queries = new QueryClient(),
    runtime = createWalletRuntime({
      scope: { ownerId: "a", generation: 1 },
      queries,
      current: () => true,
    });
  let sends = 0;
  const client = {
    request: async () => {
      sends++;
      return walletModels.a;
    },
    requestPage: async () => {
      sends++;
      return {
        data: [],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      };
    },
  };
  for (const state of ["PENDING", "PAID"]) {
    const refresh = createOwnerPaymentRefresh(
      runtime,
      queries,
      client,
      parsePayment(paymentWire(state)),
    );
    await refresh.refresh();
    assert.equal(refresh.getSnapshot().wallet.status, "unavailable");
    refresh.dispose();
  }
  assert.equal(sends, 0);
  runtime.dispose();
  queries.clear();
});
