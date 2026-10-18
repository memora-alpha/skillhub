import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, InfiniteQueryObserver } from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import type { RequestOptions } from "../src/lib/http/client";
import { createPaymentApi } from "../src/features/wallet/api/payment-api";
import {
  paymentsOptions,
  paymentItems,
  projectPayments,
} from "../src/features/wallet/utils/payments-query";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import { paymentWire } from "./fixtures/payment-api";
import { deferred } from "./fixtures/payment-observation-model";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { isInvalidLedgerCursor } from "../src/features/wallet/utils/history-query";

test("list adapter sends20/status/opaque cursor only, keeps backend order and rejects unsupported filters", async () => {
  const calls: { path: string; options?: RequestOptions }[] = [],
    signal = new AbortController().signal;
  const rows = [
    { ...paymentWire(), id: "10000000-0000-4000-8000-000000000099" },
    paymentWire(),
  ];
  const api = createPaymentApi({
    request: async () => null,
    requestPage: async (path: string, options?: RequestOptions) => {
      calls.push({ path, options });
      return {
        data: rows,
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      };
    },
  });
  const page = await api.list({ status: "PENDING" }, "opaque /token+", signal);
  assert.deepEqual(
    page.data.map((r) => r.id),
    rows.map((r) => r.id),
  );
  const url = new URL(calls[0]!.path, "http://127.0.0.1");
  assert.equal(url.pathname, "/payments");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    limit: "20",
    status: "PENDING",
    cursor: "opaque /token+",
  });
  assert.deepEqual(calls[0]?.options, {
    method: "GET",
    authenticated: true,
    signal,
  });
  for (const filter of [
    { type: "TOP_UP" },
    { referenceType: "PAYMENT" },
    { status: "SUCCESS" },
    { date: "today" },
    { search: "123" },
  ])
    await assert.rejects(api.list(filter as never, undefined, signal));
  assert.equal(calls.length, 1);
});
test("chain handles dedupe, later errors, reset/filter and late continuation isolation", async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const runtime = createWalletRuntime({
    scope: { ownerId: "a", generation: 1 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, paymentStatus: true },
  });
  const calls: string[] = [];
  let failure = false,
    late: ReturnType<typeof deferred<unknown>> | undefined;
  const rows = Array.from({ length: 45 }, (_, i) => ({
    ...paymentWire(i % 2 ? "PAID" : "PENDING"),
    id: `10000000-0000-4000-8000-${String(45 - i).padStart(12, "0")}`,
  }));
  const client = {
    request: async () => null,
    requestPage: async (path: string) => {
      calls.push(path);
      const params = new URL(path, "http://127.0.0.1").searchParams;
      if (late && params.has("cursor")) return late.promise as never;
      if (failure) throw new AppError("network");
      const selected = rows.filter(
          (r) => !params.get("status") || r.status === params.get("status"),
        ),
        offset = params.has("cursor") ? 20 : 0;
      const hasMore = selected.length > offset + 20;
      return {
        data: selected.slice(offset, offset + 20),
        pagination: {
          limit: 20,
          hasMore,
          nextCursor: hasMore ? (offset ? "opaque-last" : "opaque-next") : null,
        },
      };
    },
  };
  const options = paymentsOptions(runtime, client, queries, {}, 0),
    observer = new InfiniteQueryObserver(queries, {
      ...options,
      enabled: false,
    });
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch();
    assert.equal(
      paymentItems(observer.getCurrentResult().data?.pages).length,
      20,
    );
    failure = true;
    await observer.fetchNextPage();
    assert.equal(
      paymentItems(observer.getCurrentResult().data?.pages).length,
      20,
    );
    assert(observer.getCurrentResult().isFetchNextPageError);
    failure = false;
    await observer.fetchNextPage();
    assert.equal(
      paymentItems(observer.getCurrentResult().data?.pages).length,
      40,
    );
    const duplicate = {
      data: [parsePayment(rows[0]!)],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    };
    assert.equal(
      paymentItems([observer.getCurrentResult().data!.pages[0]!, duplicate])
        .length,
      20,
    );
    late = deferred<unknown>();
    const old = observer.fetchNextPage();
    const next = paymentsOptions(
        runtime,
        client,
        queries,
        { status: "PAID" },
        1,
      ),
      second = new InfiniteQueryObserver(queries, { ...next, enabled: false });
    const end = second.subscribe(() => {});
    try {
      await second.refetch();
      late.resolve(duplicate);
      await old;
      assert(
        paymentItems(second.getCurrentResult().data?.pages).every(
          (r) => r.status === "PAID",
        ),
      );
      assert.notDeepEqual(options.queryKey, next.queryKey);
    } finally {
      end();
    }
    assert(
      calls.every(
        (p) =>
          new URL(p, "http://127.0.0.1").searchParams.get("limit") === "20",
      ),
    );
  } finally {
    stop();
    runtime.dispose();
    queries.clear();
  }
});
test("list denial evicts all filter chains and stays hidden through transient errors", async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const runtime = createWalletRuntime({
    scope: { ownerId: "a", generation: 1 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, paymentStatus: true },
  });
  let mode = 0;
  const client = {
    request: async () => null,
    requestPage: async () => {
      if (mode)
        throw new AppError(
          mode === 1 ? "http" : "network",
          mode === 1 ? 403 : 0,
        );
      return {
        data: [paymentWire()],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      };
    },
  };
  const options = paymentsOptions(runtime, client, queries, {}, 0),
    observer = new InfiniteQueryObserver(queries, {
      ...options,
      enabled: false,
    });
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch();
    mode = 1;
    await observer.refetch();
    assert.equal(
      projectPayments(runtime, observer.getCurrentResult()).data,
      undefined,
    );
    mode = 2;
    await observer.refetch();
    assert.equal(
      projectPayments(runtime, observer.getCurrentResult()).status,
      "denied",
    );
    assert(
      !JSON.stringify(queries.getQueryData(options.queryKey)).includes(
        "creditAmount",
      ),
    );
  } finally {
    stop();
    runtime.dispose();
    queries.clear();
  }
});

test("opaque snapshot cursor excludes append but status membership can change; cross-owner/filter cursor is rejected", async () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({
    sequence: 45 - i,
    wire: {
      ...paymentWire("PENDING"),
      id: `10000000-0000-4000-8000-${String(45 - i).padStart(12, "0")}`,
    },
  }));
  let owner = "a",
    serial = 0;
  const boundaries = new Map<
    string,
    { owner: string; status?: string; watermark: number; before: number }
  >();
  const client = {
    request: async () => null,
    requestPage: async (path: string) => {
      const p = new URL(path, "http://127.0.0.1").searchParams,
        status = p.get("status") ?? undefined,
        token = p.get("cursor");
      const boundary = token
        ? boundaries.get(token)
        : { owner, status, watermark: rows[0]!.sequence, before: Infinity };
      if (!boundary || boundary.owner !== owner || boundary.status !== status)
        throw new AppError("http", 400, "INVALID_LEDGER_CURSOR");
      const selected = rows.filter(
          (r) =>
            r.sequence <= boundary.watermark &&
            r.sequence < boundary.before &&
            (!status || r.wire.status === status),
        ),
        visible = selected.slice(0, 20),
        hasMore = selected.length > 20;
      const nextCursor = hasMore ? `opaque-${++serial}` : null;
      if (nextCursor)
        boundaries.set(nextCursor, {
          ...boundary,
          before: visible.at(-1)!.sequence,
        });
      return {
        data: visible.map((r) => r.wire),
        pagination: { limit: 20, hasMore, nextCursor },
      };
    },
  };
  const api = createPaymentApi(client),
    signal = new AbortController().signal;
  const first = await api.list({ status: "PENDING" }, undefined, signal),
    cursor = first.pagination.nextCursor!;
  rows.unshift({
    sequence: 46,
    wire: {
      ...paymentWire("PENDING"),
      id: "10000000-0000-4000-8000-000000000046",
    },
  });
  rows.find((r) => r.sequence === 25)!.wire.status = "REVIEW";
  const second = await api.list({ status: "PENDING" }, cursor, signal);
  assert(
    !second.data.some(
      (r) => r.id.endsWith("000000000046") || r.id.endsWith("000000000025"),
    ),
  );
  assert.equal(
    second.data[0]?.id,
    rows.find((r) => r.sequence === 24)!.wire.id,
  );
  const fresh = await api.list({ status: "PENDING" }, undefined, signal);
  assert(fresh.data[0]?.id.endsWith("000000000046"));
  await assert.rejects(
    api.list({ status: "REVIEW" }, cursor, signal),
    isInvalidLedgerCursor,
  );
  owner = "b";
  await assert.rejects(
    api.list({ status: "PENDING" }, cursor, signal),
    isInvalidLedgerCursor,
  );
  await assert.rejects(
    api.list({}, "unknown-token", signal),
    isInvalidLedgerCursor,
  );
  // Boundary simulation proves client preserves supplied order/cursor; not BE signing.
});

test("invalid/repeated cursor pages fail safely and retired session cannot accept late list data", async () => {
  const signal = new AbortController().signal;
  for (const page of [
    {
      data: [paymentWire()],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    },
    {
      data: [paymentWire()],
      pagination: { limit: 20, hasMore: true, nextCursor: "same" },
    },
    { data: [], pagination: { limit: 20, hasMore: true, nextCursor: "next" } },
  ]) {
    const api = createPaymentApi({
      request: async () => null,
      requestPage: async () => page,
    });
    await assert.rejects(api.list({}, "same", signal));
  }
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let current = true,
    captured: AbortSignal | undefined;
  const runtime = createWalletRuntime({
      scope: { ownerId: "a", generation: 1 },
      queries,
      current: () => current,
      capabilities: { ...noWalletCapabilities, paymentStatus: true },
    }),
    late = deferred<never>();
  const options = paymentsOptions(
    runtime,
    {
      request: async () => null,
      requestPage: async (_p: string, o?: RequestOptions) => {
        captured = o?.signal;
        return late.promise;
      },
    },
    queries,
    {},
    0,
  );
  const observer = new InfiniteQueryObserver(queries, {
      ...options,
      enabled: false,
    }),
    stop = observer.subscribe(() => {});
  const pending = observer.refetch();
  current = false;
  runtime.dispose();
  assert(captured?.aborted);
  late.reject(new AppError("network"));
  await pending;
  assert.equal(
    projectPayments(runtime, observer.getCurrentResult()).status,
    "session-ended",
  );
  assert.equal(queries.getQueryCache().getAll().length, 0);
  stop();
  queries.clear();
});
