import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  readConversationResource,
  invalidateConversationResources,
} from "../src/features/messages/utils/conversation-resource";
import { AppError } from "../src/lib/http/errors";

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

test("topic refresh invalidates its shared dependencies without staling other conversations or sessions", async () => {
  const cache = new QueryClient();
  const base = ["connections", "owner", 1],
    next = ["connections", "owner", 2];
  const counts = new Map<string, number>();
  const call = async (path: string) => {
    counts.set(path, (counts.get(path) ?? 0) + 1);
    return { path };
  };
  const read = (id: string, path: string, scope = base) =>
    readConversationResource(cache, scope, call, path, undefined, id);
  try {
    await read("a", "/proposals/a");
    await read("a", "/skills/shared");
    await read("b", "/proposals/b");
    await read("b", "/skills/shared");
    await read("a", "/proposals/a", next);
    await invalidateConversationResources(cache, base, "a");
    assert.equal(
      cache.getQueryState([...base, "conversation-resource", "/proposals/a"])
        ?.isInvalidated,
      true,
    );
    assert.equal(
      cache.getQueryState([...base, "conversation-resource", "/skills/shared"])
        ?.isInvalidated,
      true,
    );
    assert.equal(
      cache.getQueryState([...base, "conversation-resource", "/proposals/b"])
        ?.isInvalidated,
      false,
    );
    assert.equal(
      cache.getQueryState([...next, "conversation-resource", "/proposals/a"])
        ?.isInvalidated,
      false,
    );
    await read("a", "/proposals/a");
    await read("b", "/proposals/b");
    await read("b", "/skills/shared");
    await read("a", "/proposals/a", next);
    assert.deepEqual(Object.fromEntries(counts), {
      "/proposals/a": 3,
      "/skills/shared": 2,
      "/proposals/b": 1,
    });
  } finally {
    cache.clear();
  }
});

test("failed secondary resources remain refresh dependencies so a recovered title replaces fallback", async () => {
  const cache = new QueryClient(),
    base = ["connections", "owner", 1];
  let fail = true;
  const call = async () => {
    if (fail) throw new AppError("http", 404);
    return { title: "Restored title" };
  };
  try {
    await assert.rejects(
      readConversationResource(
        cache,
        base,
        call,
        "/learning-requests/a",
        undefined,
        "a",
      ),
    );
    await invalidateConversationResources(cache, base, "a");
    fail = false;
    assert.deepEqual(
      await readConversationResource(
        cache,
        base,
        call,
        "/learning-requests/a",
        undefined,
        "a",
      ),
      { title: "Restored title" },
    );
  } finally {
    cache.clear();
  }
});
