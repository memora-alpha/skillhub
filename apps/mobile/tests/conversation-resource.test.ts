import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { readConversationResource } from "../src/features/messages/utils/conversation-resource";

test("Inbox and compact Chat share source reads but sessions and explicit invalidation do not", async () => {
  const cache = new QueryClient();
  let calls = 0;
  const call = async () => {
    calls++;
    return { id: "proposal", skillId: "skill" };
  };
  const base = ["connections", "owner", 1];
  try {
    await Promise.all([
      readConversationResource(cache, base, call, "/proposals/id"),
      readConversationResource(cache, base, call, "/proposals/id"),
    ]);
    await readConversationResource(cache, base, call, "/proposals/id");
    assert.equal(calls, 1);
    await readConversationResource(
      cache,
      ["connections", "owner", 2],
      call,
      "/proposals/id",
    );
    assert.equal(calls, 2);
    await cache.invalidateQueries({
      queryKey: [...base, "conversation-resource"],
      refetchType: "none",
    });
    await readConversationResource(cache, base, call, "/proposals/id");
    assert.equal(calls, 3);
  } finally {
    cache.clear();
  }
});
