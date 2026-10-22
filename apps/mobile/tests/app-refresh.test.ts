import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createReadRefresh } from "../src/lib/query/refresh-active-reads";
import { pullDistance, pullThreshold } from "../src/utils/pull-refresh";

test("pull refresh coalesces requests, refreshes active reads, skips disabled/inactive reads and mutations", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let active = 0,
    disabled = 0,
    inactive = 0,
    mutations = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  client.setQueryData(["active"], "old");
  const observer = new QueryObserver(client, {
    queryKey: ["active"],
    queryFn: async () => {
      active++;
      await gate;
      return "new";
    },
  });
  const stop = observer.subscribe(() => {});
  const blocked = new QueryObserver(client, {
    queryKey: ["disabled"],
    enabled: false,
    queryFn: async () => {
      disabled++;
      return "disabled";
    },
  });
  const stopBlocked = blocked.subscribe(() => {});
  await client.fetchQuery({
    queryKey: ["inactive"],
    queryFn: async () => {
      inactive++;
      return "inactive";
    },
  });
  client.getMutationCache().build(client, {
    mutationFn: async () => {
      mutations++;
    },
  });
  const refresh = createReadRefresh(client);
  const first = refresh(),
    second = refresh();
  assert.equal(first, second);
  release();
  await first;
  assert.equal(client.getQueryData(["active"]), "new");
  assert.deepEqual(
    { active, disabled, inactive, mutations },
    { active: 1, disabled: 0, inactive: 1, mutations: 0 },
  );
  stop();
  stopBlocked();
  client.clear();
});

test("failed refresh keeps cached content and releases its lock for another pull", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["read"], "saved");
  let fail = true;
  const observer = new QueryObserver(client, {
    queryKey: ["read"],
    queryFn: async () => {
      if (fail) throw new Error("Read unavailable");
      return "updated";
    },
  });
  const stop = observer.subscribe(() => {});
  const refresh = createReadRefresh(client);
  await refresh();
  assert.equal(client.getQueryData(["read"]), "saved");
  fail = false;
  await refresh();
  assert.equal(client.getQueryData(["read"]), "updated");
  stop();
  client.clear();
});

test("pull only activates for a downward vertical gesture at the top", () => {
  assert.equal(pullDistance(0, 90, 20), 0);
  assert.equal(pullDistance(0, -90, 0), 0);
  assert.equal(pullDistance(100, 90, 0), 0);
  assert.ok(pullDistance(0, 80, 0) >= pullThreshold);
  assert.ok(pullDistance(0, 30, 0) < pullThreshold);
});
