import assert from "node:assert/strict";
import test from "node:test";
import { listAllProposals } from "../src/features/proposals/api/list-all-proposals";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import { AppError } from "../src/lib/http/errors";
import { proposal } from "./fixtures/proposals-data";
import { fixtureId } from "./fixtures/learning-requests-data";

test("full list walks both independent cursors, including later sent pages after received ends", async () => {
  const calls: unknown[][] = [];
  const received = Array.from({ length: 25 }, (_, i) => ({
    ...proposal,
    id: fixtureId(1000 + i),
  }));
  const sent = Array.from({ length: 45 }, (_, i) => ({
    ...proposal,
    id: fixtureId(2000 + i),
  }));
  const signal = new AbortController().signal;
  const api = {
    list: async (
      direction: "sent" | "received",
      status?: Proposal["status"],
      cursor?: string,
      requestSignal?: AbortSignal,
    ) => {
      calls.push([direction, status, cursor]);
      assert.equal(requestSignal, signal);
      const data = direction === "sent" ? sent : received;
      const offset = cursor ? Number(cursor.slice(1)) : 0;
      const nextCursor =
        offset + 20 < data.length ? `${direction[0]}${offset + 20}` : null;
      return {
        items: data.slice(offset, offset + 20),
        nextCursor,
        limit: 20,
        hasMore: !!nextCursor,
      };
    },
  };
  const items: Proposal[] = [];
  let cursor: string | undefined;
  do {
    const page = await listAllProposals(api, "PENDING", cursor, signal);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(items.length, 70);
  assert.equal(new Set(items.map((item) => item.id)).size, 70);
  assert.deepEqual(calls, [
    ["received", "PENDING", undefined],
    ["sent", "PENDING", undefined],
    ["received", "PENDING", "r20"],
    ["sent", "PENDING", "s20"],
    ["sent", "PENDING", "s40"],
  ]);
});

test("a failed direction rejects the full page instead of presenting a partial list as all", async () => {
  const denied = new AppError("http", 403);
  const api = {
    list: async (direction: "sent" | "received") => {
      if (direction === "sent") throw denied;
      return { items: [proposal], nextCursor: null, limit: 20, hasMore: false };
    },
  };
  await assert.rejects(listAllProposals(api), (error) => error === denied);
});

test("malformed, mismatched-status and looping cursors cannot skip or restart a direction", async () => {
  let calls = 0;
  const api = {
    list: async () => {
      calls++;
      return {
        items: [proposal],
        nextCursor: "same",
        limit: 20,
        hasMore: true,
      };
    },
  };
  for (const cursor of [
    "not-json",
    "{}",
    JSON.stringify({ status: "REJECTED", received: "r", sent: null }),
  ]) {
    await assert.rejects(listAllProposals(api, "PENDING", cursor), AppError);
  }
  assert.equal(calls, 0);
  await assert.rejects(
    listAllProposals(
      api,
      undefined,
      JSON.stringify({ status: null, received: "same", sent: null }),
    ),
    AppError,
  );
  assert.equal(calls, 1);
});
