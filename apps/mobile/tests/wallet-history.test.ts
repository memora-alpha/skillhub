// Confirmed GET contract at17e3ac1; all identities/data/transport are synthetic.
import assert from "node:assert/strict";
import test from "node:test";
import {
  QueryClient,
  InfiniteQueryObserver,
  QueryObserver,
} from "@tanstack/react-query";
import { AppError } from "../src/lib/http/errors";
import {
  createHttpClient,
  type PaginatedHttpClient,
} from "../src/lib/http/client";
import { parseTransaction } from "../src/features/wallet/schemas/transaction-contracts";
import { createTransactionApi } from "../src/features/wallet/api/transaction-api";
import {
  historyItems,
  historyKey,
  historyOptions,
  historyNext,
  isInvalidLedgerCursor,
  projectHistory,
  fetchHistoryNext,
} from "../src/features/wallet/utils/history-query";
import {
  transactionOptions,
  projectTransaction,
} from "../src/features/wallet/utils/transaction-query";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import {
  ledgerModel,
  ledgerTypes,
  walletOwners,
} from "./fixtures/wallet-model";
import { startWalletFixture } from "./fixtures/wallet-api";

type Client = Pick<PaginatedHttpClient, "request" | "requestPage">;
const protocol = (e: unknown) => e instanceof AppError && e.kind === "protocol";
const gate = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((y, n) => {
    resolve = y;
    reject = n;
  });
  return { promise, resolve, reject };
};
const page = (start: number, cursor: string | null = null) => ({
  data: Array.from({ length: 20 }, (_, i) =>
    parseTransaction(ledgerModel(start - i)),
  ),
  pagination: { limit: 20, hasMore: cursor !== null, nextCursor: cursor },
});
const mock = (
  load: Client["requestPage"],
  detail: Client["request"] = async () => ledgerModel(220),
): Client => ({ requestPage: load, request: detail });
function setup(client: Client, enabled = true) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let current = true;
  const runtime = createWalletRuntime({
    scope: { ownerId: walletOwners.a, generation: 1 },
    queries,
    current: () => current,
    capabilities: {
      ...noWalletCapabilities,
      history: enabled,
      transaction: enabled,
    },
  });
  return {
    queries,
    runtime,
    options: historyOptions(runtime, client, queries, {}, 0),
    end: () => {
      current = false;
      runtime.dispose();
      queries.clear();
    },
  };
}
test("ledger parser preserves five exact money fields, identities/reference/reversal and neutral future codes", () => {
  for (let i = 1; i <= ledgerTypes.length; i++) {
    const wire = ledgerModel(i),
      row = parseTransaction(wire);
    assert.deepEqual(row, wire);
    assert.equal(row.amount, "100.00");
  }
  const unknown = {
    ...ledgerModel(220),
    type: "FUTURE_TYPE",
    status: "FUTURE_STATE",
    referenceType: "FUTURE_REF",
    amount: "9007199254740993.01",
    availableDelta: "-0.00",
  };
  assert.deepEqual(parseTransaction(unknown), {
    ...unknown,
    availableDelta: "0.00",
  });
  assert.equal(
    "entrySequence" in
      parseTransaction({
        ...unknown,
        entrySequence: 900,
        description: "private",
      }),
    false,
  );
});
test("ledger parser rejects malformed money/structure without rounding or fabricated fields", () => {
  for (const [field, value] of [
    ["id", "tx-topup"],
    ["operationId", "bad"],
    ["amount", "0.00"],
    ["amount", "-1.00"],
    ["amount", 100],
    ["availableDelta", "1.234"],
    ["heldDelta", 1],
    ["availableAfter", "-1.00"],
    ["heldAfter", null],
    ["createdAt", "yesterday"],
    ["createdAt", "2026-02-30T10:00:00Z"],
    ["reversesTransactionId", "bad"],
    ["referenceType", null],
  ] as const)
    assert.throws(
      () => parseTransaction({ ...ledgerModel(220), [field]: value }),
      protocol,
    );
  assert.throws(() => parseTransaction({}), protocol);
});
test("transaction adapters send exact supported query fields/page20, preserve opaque cursor and signal", async () => {
  const signal = new AbortController().signal;
  const cursor = "opaque +/=token";
  let calls = 0;
  const api = createTransactionApi(
    mock(
      async (path, options) => {
        calls++;
        const url = new URL(path, "http://fixture");
        assert.deepEqual([...url.searchParams.keys()].sort(), [
          "cursor",
          "limit",
          "referenceType",
          "type",
        ]);
        assert.equal(url.searchParams.get("limit"), "20");
        assert.equal(url.searchParams.get("cursor"), cursor);
        assert.equal(url.searchParams.get("type"), "HOLD");
        assert.equal(url.searchParams.get("referenceType"), "REVIEW");
        assert.deepEqual(options, {
          method: "GET",
          authenticated: true,
          signal,
        });
        return page(220);
      },
      async (path, options) => {
        calls++;
        assert.equal(path, "/me/wallet/transactions/" + ledgerModel(220).id);
        assert.equal(options?.signal, signal);
        return ledgerModel(220);
      },
    ),
  );
  await api.list({ type: "HOLD", referenceType: "REVIEW" }, cursor, signal);
  await api.detail(ledgerModel(220).id, signal);
  await assert.rejects(api.detail("tx-topup", signal), protocol);
  assert.equal(calls, 2);
});
test("adapter rejects unsupported filters, wrong page metadata and mismatched detail identity", async () => {
  let calls = 0;
  const signal = new AbortController().signal;
  const api = createTransactionApi(
    mock(async () => {
      calls++;
      return {
        ...page(220),
        pagination: { limit: 100, hasMore: false, nextCursor: null },
      };
    }),
  );
  await assert.rejects(
    api.list({ status: "SUCCESS" } as never, undefined, signal),
    protocol,
  );
  assert.equal(calls, 0);
  await assert.rejects(api.list({}, undefined, signal), protocol);
  await assert.rejects(api.detail(ledgerModel(219).id, signal), protocol);
});
test("keys include owner/generation/filter/chain; dedupe preserves backend order and newer duplicate projection", () => {
  const { runtime, end } = setup(mock(async () => page(220)));
  assert.notDeepEqual(
    historyKey(runtime.scope, { type: "HOLD" }, 0),
    historyKey(runtime.scope, {}, 0),
  );
  assert.notDeepEqual(
    historyKey(runtime.scope, {}, 0),
    historyKey(runtime.scope, {}, 1),
  );
  const first = page(220, "one"),
    second = {
      ...page(200),
      data: [{ ...first.data[0]!, status: "REVERSED" }, ...page(200).data],
    };
  const rows = historyItems([first, second]);
  assert.equal(rows.length, 40);
  assert.equal(rows[0]!.id, ledgerModel(220).id);
  assert.equal(rows[0]!.status, "REVERSED");
  assert.equal(rows.at(-1)!.id, ledgerModel(181).id);
  assert.equal(historyNext(first, [first], undefined, [undefined]), "one");
  assert.equal(
    historyNext(
      { ...first, pagination: { ...first.pagination, nextCursor: "one" } },
      [first],
      "one",
      [undefined, "one"],
    ),
    undefined,
  );
  end();
});
test("real loopback adapter traverses220 entries once with snapshot append, AND filters and owner404", async () => {
  const fixture = await startWalletFixture();
  let actor = "a";
  const client = createHttpClient(() => fixture.url);
  client.bindSession({
    generation: 1,
    getToken: async () => "fixture-" + actor,
    renew: async () => {},
    expire: async () => {},
  });
  const { queries, runtime, options, end } = setup(client);
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    fixture.append();
    while (observer.getCurrentResult().hasNextPage)
      await observer.fetchNextPage({ cancelRefetch: false });
    const data = observer.getCurrentResult().data!;
    const rows = historyItems(data.pages);
    assert.equal(rows.length, 220);
    assert.equal(new Set(rows.map((r) => r.id)).size, 220);
    assert.equal(rows[0]!.id, ledgerModel(220).id);
    assert.equal(rows.at(-1)!.id, ledgerModel(1).id);
    assert(data.pages.every((p) => p.pagination.limit === 20));
    await observer.refetch();
    const refreshed = historyItems(observer.getCurrentResult().data!.pages);
    assert.equal(refreshed[0]!.id, ledgerModel(221).id);
    const api = createTransactionApi(client),
      signal = new AbortController().signal;
    const filtered = await api.list(
      { type: "HOLD", referenceType: "REVIEW" },
      undefined,
      signal,
    );
    assert(filtered.data.length > 0);
    assert(
      filtered.data.every(
        (r) => r.type === "HOLD" && r.referenceType === "REVIEW",
      ),
    );
    const oldCursor = data.pages[0]!.pagination.nextCursor!;
    await assert.rejects(
      client.requestPage("/me/wallet/transactions?limit=100", {
        authenticated: true,
      }),
      protocol,
    );
    await assert.rejects(
      api.list({ type: "HOLD" }, oldCursor, signal),
      isInvalidLedgerCursor,
    );
    actor = "b";
    await assert.rejects(
      api.detail(ledgerModel(220).id, signal),
      (e: unknown) => e instanceof AppError && e.status === 404,
    );
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).data?.[0]?.id,
      ledgerModel(221).id,
    );
  } finally {
    stop();
    end();
    await fixture.close();
  }
});
test("refresh rebuilds each continuation from new first page; failed refresh retains entire old snapshot", async () => {
  let revision = "old",
    fail = false;
  const seen: string[] = [];
  const client = mock(async (path) => {
    const cursor = new URL(path, "http://fixture").searchParams.get("cursor");
    seen.push(cursor ?? "FIRST");
    if (fail && cursor === "new") throw new AppError("http", 503);
    return cursor ? page(200) : page(revision === "old" ? 220 : 221, revision);
  });
  const { runtime, options, queries, end } = setup(client);
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    await observer.fetchNextPage();
    const before = observer.getCurrentResult().data;
    revision = "new";
    fail = true;
    await observer.refetch();
    assert.deepEqual(observer.getCurrentResult().data, before);
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).status,
      "refresh-error",
    );
    fail = false;
    await observer.refetch();
    assert.deepEqual(seen, ["FIRST", "old", "FIRST", "new", "FIRST", "new"]);
    assert.equal(observer.getCurrentResult().data!.pageParams[1], "new");
  } finally {
    stop();
    end();
  }
});
test("load-more failure keeps previous pages, retry uses same cursor; invalid cursor never auto-restarts", async () => {
  let error: AppError | undefined;
  const cursors: (string | null)[] = [];
  const { runtime, options, queries, end } = setup(
    mock(async (path) => {
      const cursor = new URL(path, "http://fixture").searchParams.get("cursor");
      cursors.push(cursor);
      if (cursor && error) throw error;
      return cursor ? page(200) : page(220, "token");
    }),
  );
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    error = new AppError("http", 503);
    await observer.fetchNextPage();
    assert.equal(
      historyItems(observer.getCurrentResult().data!.pages).length,
      20,
    );
    error = new AppError("http", 400, "INVALID_LEDGER_CURSOR");
    await observer.fetchNextPage();
    assert(isInvalidLedgerCursor(observer.getCurrentResult().error));
    assert.deepEqual(cursors, [null, "token", "token"]);
    error = undefined;
    await observer.fetchNextPage();
    assert.equal(
      historyItems(observer.getCurrentResult().data!.pages).length,
      40,
    );
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).status,
      "ready",
    );
  } finally {
    stop();
    end();
  }
});
test("load-more coalesces and refuses to append while snapshot replacement is active", async () => {
  const delayed = gate<ReturnType<typeof page>>();
  let pending = false,
    calls = 0;
  const { runtime, queries, options, end } = setup(
    mock(async () => {
      calls++;
      return pending ? delayed.promise : page(220, "token");
    }),
  );
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    pending = true;
    const refreshing = observer.refetch();
    await fetchHistoryNext(
      queries,
      options.queryKey,
      () => observer.fetchNextPage(),
      runtime.isCurrent,
    );
    assert.equal(calls, 2);
    delayed.resolve(page(221, "new"));
    await refreshing;
    assert.equal(
      historyItems(observer.getCurrentResult().data!.pages)[0]!.id,
      ledgerModel(221).id,
    );
  } finally {
    stop();
    end();
  }
});
test("late old-filter page/ignored abort cannot populate new selection or a new account", async () => {
  const delayed = gate<ReturnType<typeof page>>();
  const { queries, runtime, end } = setup(mock(async () => delayed.promise));
  const old = queries.fetchInfiniteQuery(
      historyOptions(
        runtime,
        mock(async () => delayed.promise),
        queries,
        { type: "TOP_UP" },
        0,
      ),
    ),
    rejected = assert.rejects(old);
  const currentOptions = historyOptions(
    runtime,
    mock(async () => page(210)),
    queries,
    { type: "HOLD" },
    1,
  );
  await queries.fetchInfiniteQuery(currentOptions);
  delayed.resolve(page(220));
  await rejected;
  assert.equal(
    historyItems(queries.getQueryData(currentOptions.queryKey)!.pages)[0]!.id,
    ledgerModel(210).id,
  );
  end();
  assert.equal(queries.getQueryData(currentOptions.queryKey), undefined);
});
test("list denial evicts all filter chains; later error/cancellation never restores private pages", async () => {
  let mode = "ok";
  const client = mock(async () => {
    if (mode === "deny") throw new AppError("http", 403);
    if (mode === "error") throw new AppError("network");
    return page(220);
  });
  const { runtime, queries, options, end } = setup(client);
  const other = historyOptions(runtime, client, queries, { type: "HOLD" }, 0);
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    await queries.fetchInfiniteQuery(other);
    mode = "deny";
    await observer.refetch();
    assert(
      !JSON.stringify(
        queries.getQueriesData({ queryKey: [...runtime.key, "history"] }),
      ).includes("123.45"),
    );
    mode = "error";
    await observer.refetch();
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).status,
      "denied",
    );
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).data,
      undefined,
    );
  } finally {
    stop();
    end();
  }
});
test("detail validates target, evicts denied data, never falls back to a cached list row", async () => {
  let mode = "ok";
  const client = mock(
    async () => page(220),
    async () => {
      if (mode === "deny") throw new AppError("http", 404);
      if (mode === "error") throw new AppError("network");
      return ledgerModel(220);
    },
  );
  const { runtime, queries, end } = setup(client),
    id = ledgerModel(220).id,
    options = transactionOptions(runtime, client, id);
  const observer = new QueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    assert.equal(
      projectTransaction(runtime, id, observer.getCurrentResult()).data?.id,
      id,
    );
    mode = "deny";
    await observer.refetch();
    mode = "error";
    await observer.refetch();
    assert.equal(
      projectTransaction(runtime, id, observer.getCurrentResult()).status,
      "not-found",
    );
    assert(
      !JSON.stringify(queries.getQueryData(options.queryKey)).includes(
        "123.45",
      ),
    );
    assert.equal(
      transactionOptions(runtime, client, "tx-topup").enabled,
      false,
    );
  } finally {
    stop();
    end();
  }
});
test("disabled/hydrating history and detail never dispatch or expose cached samples", () => {
  let calls = 0;
  const client = mock(async () => {
    calls++;
    return page(220);
  });
  const { runtime, queries, options, end } = setup(client, false);
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  assert.equal(calls, 0);
  assert.equal(
    projectHistory(runtime, observer.getCurrentResult()).status,
    "unavailable",
  );
  assert.equal(transactionOptions(null, null, "tx-topup").enabled, false);
  stop();
  end();
});

test("refresh supersedes an ignored-abort next page; only the fresh chain is accepted", async () => {
  const delayed = gate<ReturnType<typeof page>>();
  let revision = 220;
  const { runtime, queries, options, end } = setup(
    mock(async (path) =>
      new URL(path, "http://fixture").searchParams.has("cursor")
        ? delayed.promise
        : page(revision, "cursor"),
    ),
  );
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  try {
    await observer.refetch({ cancelRefetch: false });
    const older = observer.fetchNextPage();
    revision = 221;
    await observer.refetch({ cancelRefetch: true });
    delayed.resolve(page(200));
    await older;
    assert.equal(
      historyItems(observer.getCurrentResult().data!.pages).length,
      20,
    );
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).data?.[0]?.id,
      ledgerModel(221).id,
    );
  } finally {
    stop();
    end();
  }
});

test("A detail404 after retirement cannot deny or populate a new B scope", async () => {
  const delayed = gate<unknown>();
  const aClient = mock(
    async () => page(220),
    async () => delayed.promise,
  );
  const { runtime, queries } = setup(aClient),
    id = ledgerModel(220).id;
  const aOptions = transactionOptions(runtime, aClient, id),
    old = queries.fetchQuery(aOptions),
    rejected = assert.rejects(old);
  runtime.dispose();
  const b = createWalletRuntime({
    scope: { ownerId: walletOwners.b, generation: 2 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, transaction: true },
  });
  const bOptions = transactionOptions(
    b,
    mock(async () => page(220)),
    id,
  );
  await queries.fetchQuery(bOptions);
  delayed.reject(new AppError("http", 404));
  await rejected;
  assert.equal(queries.getQueryData(aOptions.queryKey), undefined);
  const data = queries.getQueryData(bOptions.queryKey);
  assert.equal(data?.kind, "row");
  b.dispose();
  queries.clear();
});

test("cancelling at denial notification cannot revert to cached private pages", async () => {
  let deny = false;
  const { runtime, queries, options, end } = setup(
    mock(async () => {
      if (deny) throw new AppError("http", 403);
      return page(220);
    }),
  );
  const observer = new InfiniteQueryObserver(queries, options),
    stop = observer.subscribe(() => {});
  let cancellation: Promise<void> | undefined;
  const unwatch = queries.getQueryCache().subscribe((event) => {
    const data = event.query.state.data as { denial?: string } | undefined;
    if (data?.denial && !cancellation)
      cancellation = queries.cancelQueries(
        { queryKey: options.queryKey },
        { revert: true },
      );
  });
  try {
    await observer.refetch({ cancelRefetch: false });
    deny = true;
    await observer.refetch();
    await cancellation;
    assert(
      !JSON.stringify(queries.getQueryData(options.queryKey)).includes(
        "123.45",
      ),
    );
    assert.equal(
      projectHistory(runtime, observer.getCurrentResult()).status,
      "denied",
    );
  } finally {
    unwatch();
    stop();
    end();
  }
});
