import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import {
  createNotificationsApi,
  type InboxNotification,
} from "../src/features/notifications/api/notifications-api";
import { notificationTarget } from "../src/features/notifications/utils/notification-target";
import { createChatEventHydrator } from "../src/features/messages/utils/event-hydration";

const id = "10000000-0000-4000-8000-000000000001";
const eventId = "10000000-0000-4000-8000-000000000002";
const item: InboxNotification = {
  id,
  type: "LEARNING_REQUEST_REJECTED",
  title: "Yêu cầu học cần điều chỉnh",
  body: "Cần mô tả mục tiêu rõ hơn.",
  payload: { requestId: eventId },
  readAt: null,
  createdAt: "2026-10-20T00:00:00.000Z",
};
const page = (data: unknown[] = [item], nextCursor: string | null = null) => ({
  data,
  meta: { pagination: { limit: 20, hasMore: nextCursor !== null, nextCursor } },
});

test("inbox uses authenticated HTTP, opaque cursor, 204 read and retains rejection reason", async (t) => {
  const requests: string[] = [];
  let read = false;
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer fixture-only-token");
    requests.push(`${req.method} ${req.url}`);
    res.setHeader("Content-Type", "application/json");
    if (req.method === "PATCH") {
      assert.equal(req.url, `/notifications/${id}/read`);
      read = true;
      res.writeHead(204).end();
    } else {
      res.end(
        JSON.stringify({
          success: true,
          ...page([{ ...item, readAt: read ? item.createdAt : null }]),
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const http = createHttpClient(() => `http://127.0.0.1:${address.port}`);
  http.bindSession({
    generation: 1,
    getToken: async () => "fixture-only-token",
    renew: async () => {},
    expire: async () => {},
  });
  const api = createNotificationsApi((path, options) =>
    http.request(path, { ...options, authenticated: true }),
  );
  const signal = new AbortController().signal;
  assert.equal(
    (await api.list("opaque|cursor+/=", signal)).items[0]?.body,
    item.body,
  );
  assert.match(requests[0]!, /cursor=opaque%7Ccursor%2B%2F%3D/);
  await api.markRead(id);
  await api.markRead(id);
  assert.equal((await api.list()).items[0]?.readAt, item.createdAt);
});

test("invalid notification IDs never reach transport and malformed pages fail closed", async () => {
  let calls = 0;
  const api = createNotificationsApi(async () => {
    calls++;
    return page();
  });
  await assert.rejects(api.markRead("../../other-user"), AppError);
  assert.equal(calls, 0);
  for (const input of [
    page([{ ...item, id: "preview-id" }]),
    page([{ ...item, readAt: "invalid" }]),
    {
      ...page(),
      meta: { pagination: { limit: 20, hasMore: true, nextCursor: null } },
    },
  ]) {
    await assert.rejects(
      createNotificationsApi(async () => input).list(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});

test("navigation builds only verified resource routes and rejects payload links or mismatched types", () => {
  assert.deepEqual(notificationTarget(item), {
    pathname: "/requests/[id]",
    params: { id: eventId },
  });
  const mappings = [
    ["chat.message.delivered", { conversationId: id }, "/chat/[proposalId]"],
    ["proposal.accepted", { proposalId: id }, "/proposal/[id]"],
    [
      "skill.verification.decided",
      { sharingSkillId: id, verificationId: eventId },
      "/my-skills/[sharingSkillId]/verifications/[verificationId]",
    ],
    ["learning-path.locked", { pathId: id }, "/paths/[id]"],
  ] as const;
  for (const [type, payload, pathname] of mappings) {
    const target = notificationTarget({ ...item, type, payload });
    assert.equal(
      typeof target === "object" ? target.pathname : undefined,
      pathname,
    );
  }
  for (const payload of [
    null,
    [],
    { requestId: "demo-request", href: "https://evil.test" },
    { href: "/wallet" },
  ])
    assert.equal(notificationTarget({ ...item, payload }), undefined);
  assert.equal(
    notificationTarget({
      ...item,
      type: "unknown",
      payload: { requestId: id },
    }),
    undefined,
  );
});

function hydrationHarness() {
  const reloads: unknown[] = [];
  let fail = false;
  const hydration = createChatEventHydrator({
    assertCurrent: () => {},
    renew: async () => {},
    ready: () => {},
    reload: async (prefixes) => {
      if (fail) throw new Error("fixture hydration failure");
      reloads.push(prefixes);
    },
  });
  const frame = (event: string, cursor = "next") => ({
    event,
    id: cursor,
    data: JSON.stringify({ eventId, version: 1, data: { notificationId: id } }),
  });
  return {
    hydration,
    reloads,
    frame,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
test("notification SSE invalidates inbox before cursor advances; replay dedupes and fresh stream recovers", async () => {
  const { hydration, reloads, frame, fail } = hydrationHarness();
  const signal = new AbortController().signal;
  await hydration.handle(
    { event: "stream.ready", id: "head", data: "{}" },
    signal,
  );
  assert.ok(
    (reloads[0] as string[][]).some((key) => key[0] === "notifications"),
  );
  fail(true);
  await assert.rejects(hydration.handle(frame("notification.created"), signal));
  assert.equal(hydration.cursor, "head");
  fail(false);
  await hydration.handle(frame("notification.created"), signal);
  assert.deepEqual(reloads[1], [["notifications"]]);
  assert.equal(hydration.cursor, "next");
  await hydration.handle(frame("notification.created", "replay"), signal);
  assert.equal(reloads.length, 2);
  assert.equal(hydration.cursor, "replay");
  hydration.reset();
  await hydration.handle(frame("notification.read", "read"), signal);
  assert.deepEqual(reloads[2], [["notifications"]]);
});

test("malformed notification event, aborted operation and stale session cannot acknowledge cursor", async () => {
  const { hydration, frame } = hydrationHarness();
  await assert.rejects(
    hydration.handle(
      {
        ...frame("notification.read"),
        data: JSON.stringify({
          eventId,
          version: 1,
          data: { notificationId: "wrong" },
        }),
      },
      new AbortController().signal,
    ),
    AppError,
  );
  assert.equal(hydration.cursor, undefined);
  const abort = new AbortController();
  abort.abort();
  await hydration.handle(frame("notification.read"), abort.signal);
  assert.equal(hydration.cursor, undefined);
  const stale = createChatEventHydrator({
    reload: async () => {},
    assertCurrent: () => {
      throw new AppError("session");
    },
    renew: async () => {},
    ready: () => {},
  });
  await assert.rejects(
    stale.handle(frame("notification.read"), new AbortController().signal),
    AppError,
  );
  assert.equal(stale.cursor, undefined);
});
