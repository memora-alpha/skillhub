import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { QueryClient, InfiniteQueryObserver } from "@tanstack/react-query";
import {
  requestListOptions,
  requestListItems,
  fetchRequestNextPage,
  isInvalidRequestCursor,
} from "../src/features/learning-requests/utils/request-list-query";
import { AppError } from "../src/lib/http/errors";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import { fixtureClient } from "./fixtures/learning-requests-client";
import {
  fixtureUsers,
  fixtureSkills,
  fixtureRequest,
} from "./fixtures/learning-requests-data";

async function waitUntil(check: () => boolean) {
  for (let n = 0; n < 200 && !check(); n++) await delay(5);
  assert.ok(check(), "Fixture request must reach the expected state");
}
test("TanStack refetch rebuilds both pages with fresh matching cursors", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const observer = new InfiniteQueryObserver(
    client,
    requestListOptions(api, ["lr", fixtureUsers[0].id, 1], "recommended", {}),
  );
  const stop = observer.subscribe(() => {});
  t.after(stop);
  await observer.refetch({ cancelRefetch: false });
  await observer.fetchNextPage();
  assert.equal(observer.getCurrentResult().data?.pages.length, 2);
  await fixture.control({ matchingVersion: 2 });
  const result = await observer.refetch();
  assert.equal(result.error, null);
  assert.equal(result.data?.pages.length, 2);
  assert.equal(requestListItems(result.data?.pages).length, 25);
  assert.equal(
    fixture.events.some((event) => event.status === 400),
    false,
  );
});
test("an invalid next cursor preserves page one and manual refetch restarts the chain", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const observer = new InfiniteQueryObserver(
    client,
    requestListOptions(
      fixtureClient(fixture.url),
      ["lr", "a", 1],
      "recommended",
      {},
    ),
  );
  const stop = observer.subscribe(() => {});
  t.after(stop);
  await observer.refetch({ cancelRefetch: false });
  await fixture.control({ matchingVersion: 2 });
  const failed = await observer.fetchNextPage();
  assert.equal(isInvalidRequestCursor(failed.error), true);
  assert.equal(requestListItems(failed.data?.pages).length, 20);
  const refreshed = await observer.refetch();
  assert.equal(refreshed.error, null);
  const next = await observer.fetchNextPage();
  assert.equal(next.error, null);
  assert.equal(requestListItems(next.data?.pages).length, 25);
});
test("network/503 next-page failure keeps earlier data and is not mistaken for initial failure", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const observer = new InfiniteQueryObserver(
    client,
    requestListOptions(fixtureClient(fixture.url), ["lr", "a", 1], "mine", {}),
  );
  const stop = observer.subscribe(() => {});
  t.after(stop);
  await observer.refetch({ cancelRefetch: false });
  for (const kind of ["http", "network"] as const) {
    await fixture.control({
      rules: [{ kind, method: "GET", cursor: true, status: 503 }],
    });
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.equal(failed.isLoadingError, false);
    assert.equal(requestListItems(failed.data?.pages).length, 20);
  }
  const recovered = await observer.fetchNextPage();
  assert.equal(requestListItems(recovered.data?.pages).length, 25);
});
test("load-more is a no-op while the same query is background-refetching", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const options = requestListOptions(
    fixtureClient(fixture.url),
    ["lr", "a", 1],
    "mine",
    {},
  );
  const observer = new InfiniteQueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  t.after(stop);
  await observer.refetch({ cancelRefetch: false });
  await fixture.control({
    rules: [{ kind: "delay", method: "GET", cursor: false, delayMs: 100 }],
  });
  const refresh = observer.refetch();
  await waitUntil(() => fixture.events.some((event) => event.status === 0));
  const count = fixture.events.length;
  await fetchRequestNextPage(client, options.queryKey, () =>
    observer.fetchNextPage({ cancelRefetch: false }),
  );
  assert.equal(fixture.events.length, count);
  await refresh;
  await fetchRequestNextPage(client, options.queryKey, () =>
    observer.fetchNextPage({ cancelRefetch: false }),
  );
  assert.equal(observer.getCurrentResult().data?.pages.length, 2);
});
test("changing filters during a delayed query cannot replace the new result", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url),
    key = ["lr", "a", 1] as const;
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const observer = new InfiniteQueryObserver(
    client,
    requestListOptions(api, key, "mine", { keyword: "React" }),
  );
  const stop = observer.subscribe(() => {});
  t.after(stop);
  await observer.refetch({ cancelRefetch: false });
  await fixture.control({
    rules: [{ kind: "delay", method: "GET", delayMs: 80 }],
  });
  const old = observer.refetch();
  await waitUntil(() => fixture.events.some((event) => event.status === 0));
  observer.setOptions(
    requestListOptions(api, key, "mine", { skillId: fixtureSkills[1].id }),
  );
  const result = await observer.refetch({ cancelRefetch: false });
  await old;
  assert.ok(
    result.data?.pages[0]?.items.every(
      (item) => "skillId" in item && item.skillId === fixtureSkills[1].id,
    ),
  );
  assert.deepEqual(observer.getCurrentResult().data, result.data);
});
test("an obsolete account query cannot populate the next account cache", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  let current = true;
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const options = requestListOptions(
    fixtureClient(fixture.url, 0, () => current),
    ["lr", fixtureUsers[0].id, 1],
    "mine",
    {},
  );
  await fixture.control({
    rules: [{ kind: "delay", method: "GET", delayMs: 80 }],
  });
  const pending = client.fetchInfiniteQuery(options);
  const rejected = assert.rejects(pending);
  await waitUntil(() => fixture.events.some((event) => event.status === 0));
  current = false;
  client.removeQueries({ queryKey: ["lr", fixtureUsers[0].id, 1] });
  const next = await client.fetchInfiniteQuery(
    requestListOptions(
      fixtureClient(fixture.url, 1),
      ["lr", fixtureUsers[1].id, 2],
      "mine",
      {},
    ),
  );
  await rejected;
  assert.equal(client.getQueryData(options.queryKey), undefined);
  assert.ok(
    next.pages[0]?.items.every((item) => item.id !== fixtureRequest().id),
  );
});
test("query400 is not cursor400 and never triggers automatic retry/reset", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const client = new QueryClient();
  t.after(() => client.clear());
  await assert.rejects(
    () =>
      client.fetchInfiniteQuery(
        requestListOptions(fixtureClient(fixture.url), ["lr", "a", 1], "mine", {
          keyword: "x".repeat(121),
        }),
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "INVALID_REQUEST_QUERY" &&
      !isInvalidRequestCursor(error),
  );
  assert.equal(fixture.events.length, 1);
});
test("dedupe keeps server order and the newest projection for a repeated ID", () => {
  const first = fixtureRequest(),
    second = fixtureRequest({ id: fixtureSkills[1].id });
  const items = requestListItems([
    { items: [first, second], hasMore: true, nextCursor: "opaque" },
    { items: [{ ...first, version: 2 }], hasMore: false, nextCursor: null },
  ]);
  assert.deepEqual(
    items.map((item) => item.id),
    [first.id, second.id],
  );
  assert.ok("version" in items[0]! && items[0].version === 2);
});
