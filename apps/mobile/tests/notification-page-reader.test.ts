import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { notificationPageReader } from "../src/features/notifications/utils/page-reader";

test("badge and list share page reads until invalidated and keep session scopes separate", async () => {
  const cache = new QueryClient();
  let reads = 0;
  const api = {
    list: async () => {
      reads++;
      return { items: [], hasMore: false, nextCursor: null, limit: 20 };
    },
    markRead: async () => {},
  };
  const base = ["connections", "owner", 1];
  const list = notificationPageReader(cache, base, api),
    badge = notificationPageReader(cache, base, api);
  try {
    await Promise.all([list(), badge()]);
    await badge();
    assert.equal(reads, 1);
    await cache.invalidateQueries({
      queryKey: [...base, "notifications"],
      refetchType: "none",
    });
    await Promise.all([list(), badge()]);
    assert.equal(reads, 2);
    await notificationPageReader(cache, ["connections", "owner", 2], api)();
    assert.equal(reads, 3);
  } finally {
    cache.clear();
  }
});
