import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  refreshConnectionReads,
  invalidateConnectionReads,
} from "../src/features/connections/read-refresh";

test("focus reuses fresh metadata, reads invalidated data and shares an in-flight refresh", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30000 } },
  });
  const key = ["connections", "owner", 1, "conversation", "id"];
  let calls = 0;
  let finish: (() => void) | undefined;
  cache.setQueryData(key, "cached");
  const observer = new QueryObserver(cache, {
    queryKey: key,
    queryFn: async () => {
      calls++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return "fresh";
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await refreshConnectionReads(cache, key, true);
    assert.equal(calls, 0);
    await cache.invalidateQueries({ queryKey: key, refetchType: "none" });
    const first = refreshConnectionReads(cache, key, true);
    const second = refreshConnectionReads(cache, key, true);
    assert.equal(calls, 1);
    finish!();
    await Promise.all([first, second]);
    await refreshConnectionReads(cache, key, true);
    assert.equal(calls, 1);
    const explicit = refreshConnectionReads(cache, key, false);
    assert.equal(calls, 2);
    finish!();
    await explicit;
  } finally {
    unsubscribe();
    cache.clear();
  }
});

test("command invalidation targets the changed resource and exact list without refetching every preview", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const base = ["connections", "owner", 1];
  const counts = new Map<string, number>();
  const stops = [
    ["proposal", "changed"],
    ["proposal", "other"],
    ["conversations"],
    ["conversations", "preview", "other"],
    ["participant-profile", "other"],
  ].map((part) => {
    const name = JSON.stringify(part),
      key = [...base, ...part];
    cache.setQueryData(key, "old");
    return new QueryObserver(cache, {
      queryKey: key,
      queryFn: async () => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        return "new";
      },
    }).subscribe(() => {});
  });
  try {
    await invalidateConnectionReads(cache, base, [
      ["proposal", "changed"],
      { key: ["conversations"], exact: true },
    ]);
    assert.deepEqual([...counts.keys()].sort(), [
      '["conversations"]',
      '["proposal","changed"]',
    ]);
  } finally {
    stops.forEach((stop) => stop());
    cache.clear();
  }
});
