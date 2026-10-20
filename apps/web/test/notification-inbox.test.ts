import assert from "node:assert/strict";
import test from "node:test";
import { StaffApiError, type PortalApi } from "../src/lib/staff/client";
import { createNotificationInbox } from "../src/lib/staff/notification-inbox";
import {
  createEventParser,
  createNotificationHydrator,
} from "../src/lib/staff/notification-events";
import type { InboxNotification, ApiEnvelope } from "../src/lib/staff/types";

const id = (index: number) =>
  `10000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const row = (index: number): InboxNotification => ({
  id: id(index),
  type: "notice",
  title: "Thông báo",
  body: "Nội dung riêng tư",
  readAt: null,
  createdAt: "2026-10-20T00:00:00.000Z",
});
const page = (
  items: InboxNotification[],
  nextCursor: string | null = null,
) => ({
  success: true,
  data: items,
  meta: { pagination: { limit: 20, nextCursor, hasMore: nextCursor !== null } },
});
function harness() {
  let rows = Array.from({ length: 25 }, (_, index) => row(index + 1));
  let error: StaffApiError | undefined;
  const calls: { path: string; method?: string }[] = [];
  let expired = false;
  const api: PortalApi = async <T>(
    path: string,
    options?: Parameters<PortalApi>[1],
  ) => {
    calls.push({ path, method: options?.method });
    if (error) throw error;
    if (options?.method === "PATCH") {
      const item = rows.find((item) => path.includes(item.id));
      if (!item) throw new StaffApiError(404, "NOT_FOUND");
      item.readAt ??= "2026-10-20T01:00:00.000Z";
      return { success: true, data: null as T };
    }
    const cursor = new URL(path, "https://fixture.test").searchParams.get(
      "cursor",
    );
    const start = cursor ? rows.findIndex((item) => item.id === cursor) + 1 : 0;
    const items = rows.slice(start, start + 20).map((item) => ({ ...item }));
    return page(
      items,
      start + 20 < rows.length ? items.at(-1)!.id : null,
    ) as ApiEnvelope<T>;
  };
  const inbox = createNotificationInbox(api, () => {
    expired = true;
  });
  return {
    inbox,
    calls,
    rows: (value: InboxNotification[]) => {
      rows = value;
    },
    fail: (value?: StaffApiError) => {
      error = value;
    },
    expired: () => expired,
  };
}
test("read/refresh preserves loaded pages, server ordering and newer head notifications", async () => {
  const h = harness();
  await h.inbox.reload();
  await h.inbox.more();
  assert.equal(h.inbox.snapshot().items.length, 25);
  assert.equal(await h.inbox.markRead(id(25)), true);
  await h.inbox.reload();
  assert.equal(h.inbox.snapshot().items.length, 25);
  assert.equal(
    h.inbox.snapshot().items[24]?.readAt,
    "2026-10-20T01:00:00.000Z",
  );
  h.rows([
    row(99),
    ...Array.from({ length: 25 }, (_, index) => row(index + 1)),
  ]);
  await h.inbox.reload();
  assert.equal(h.inbox.snapshot().items.length, 26);
  assert.equal(h.inbox.snapshot().items[0]?.id, id(99));
  h.inbox.dispose();
});
test("transient refresh and load-more errors retain content; permission denial clears it until a successful read", async () => {
  const h = harness();
  await h.inbox.reload();
  h.fail(new StaffApiError(503, "API_UNAVAILABLE"));
  await assert.rejects(h.inbox.more());
  assert.equal(h.inbox.snapshot().items.length, 20);
  assert.equal(h.inbox.snapshot().page?.hasMore, true);
  await assert.rejects(h.inbox.reload());
  assert.equal(h.inbox.snapshot().items.length, 20);
  h.fail(new StaffApiError(403, "FORBIDDEN"));
  await assert.rejects(h.inbox.reload());
  assert.deepEqual(h.inbox.snapshot().items, []);
  h.fail(new StaffApiError(503, "API_UNAVAILABLE"));
  await assert.rejects(h.inbox.reload());
  assert.deepEqual(h.inbox.snapshot().items, []);
  h.fail();
  await h.inbox.reload();
  assert.equal(h.inbox.snapshot().items.length, 20);
  h.inbox.dispose();
});
test("failed reads remain unread, double clicks do not duplicate mutations and expired sessions clear state", async () => {
  const h = harness();
  await h.inbox.reload();
  h.fail(new StaffApiError(503, "API_UNAVAILABLE"));
  assert.equal(await h.inbox.markRead(id(1)), false);
  assert.equal(h.inbox.snapshot().items[0]?.readAt, null);
  h.fail();
  const first = h.inbox.markRead(id(1));
  assert.equal(await h.inbox.markRead(id(1)), false);
  assert.equal(await first, true);
  assert.equal(h.calls.filter((call) => call.method === "PATCH").length, 2); // Failed attempt + one confirmed write.
  await h.inbox.reload();
  h.fail(new StaffApiError(401, "SESSION_EXPIRED"));
  await assert.rejects(h.inbox.reload());
  assert.equal(h.expired(), true);
  assert.deepEqual(h.inbox.snapshot().items, []);
  h.inbox.dispose();
});
test("events during an in-flight snapshot wait for a new snapshot, and disposal ignores late responses", async () => {
  let finish!: (value: ApiEnvelope<InboxNotification[]>) => void;
  let calls = 0;
  const api: PortalApi = <T>() => {
    calls++;
    if (calls === 1)
      return new Promise<ApiEnvelope<T>>((resolve) => {
        finish = resolve as typeof finish;
      });
    return Promise.resolve(page([row(2), row(1)]) as ApiEnvelope<T>);
  };
  const inbox = createNotificationInbox(api, () => {});
  const initial = inbox.reload(),
    event = inbox.reload();
  finish(page([row(1)]));
  await initial;
  await event;
  assert.equal(calls, 2);
  assert.equal(inbox.snapshot().items[0]?.id, id(2));
  inbox.dispose();
  const old = createNotificationInbox(
    (<T>() =>
      new Promise<ApiEnvelope<T>>((resolve) => {
        finish = resolve as typeof finish;
      })) as PortalApi,
    () => {},
  );
  const pending = old.reload();
  old.dispose();
  finish(page([row(1)]));
  await pending;
  assert.deepEqual(old.snapshot().items, []);
});
test("malformed pages and cursor cycles never become a successful inbox snapshot", async () => {
  for (const result of [
    page([{ ...row(1), id: "mock" }]),
    {
      ...page([]),
      meta: { pagination: { limit: 20, nextCursor: null, hasMore: true } },
    },
  ]) {
    const inbox = createNotificationInbox(
      (async () => result) as PortalApi,
      () => {},
    );
    await assert.rejects(inbox.reload(), StaffApiError);
    assert.deepEqual(inbox.snapshot().items, []);
    inbox.dispose();
  }
  const cycle = createNotificationInbox(
    (async () => page([row(1)], "same-cursor")) as PortalApi,
    () => {},
  );
  await cycle.reload();
  await assert.rejects(cycle.more(), StaffApiError);
  assert.equal(cycle.snapshot().items.length, 1);
  cycle.dispose();
});
test("parser preserves fragmented CRLF/multiline frames and ignores heartbeat comments", () => {
  const parser = createEventParser();
  assert.deepEqual(parser.feed(": heartbeat\r\n\r\nid: opa"), []);
  assert.deepEqual(
    parser.feed(
      "que\r\nevent: notification.created\r\ndata: one\r\ndata: two\r\n\r\n",
    ),
    [{ id: "opaque", event: "notification.created", data: "one\ntwo" }],
  );
  assert.throws(
    () => createEventParser().feed("x".repeat(262145)),
    StaffApiError,
  );
});
test("notification hydration acknowledges only successful reloads, dedupes replay and resyncs fresh streams", async () => {
  let reloads = 0,
    fail = false;
  const hydration = createNotificationHydrator({
    reload: async () => {
      if (fail) throw new Error("fixture error");
      reloads++;
    },
    renew: async () => {},
    ready: () => {},
  });
  const signal = new AbortController().signal;
  await hydration.handle(
    { event: "stream.ready", data: "{}", id: "head" },
    signal,
  );
  assert.equal(reloads, 1);
  const frame = {
    event: "notification.created",
    data: JSON.stringify({
      eventId: id(9),
      version: 1,
      data: { notificationId: id(1) },
    }),
    id: "next",
  };
  fail = true;
  await assert.rejects(hydration.handle(frame, signal));
  assert.equal(hydration.cursor, "head");
  fail = false;
  await hydration.handle(frame, signal);
  await hydration.handle(frame, signal);
  assert.equal(reloads, 2);
  assert.equal(hydration.cursor, "next");
  await assert.rejects(
    hydration.handle({ event: "stream.reset-required", data: "{}" }, signal),
  );
  assert.equal(hydration.cursor, undefined);
  await hydration.handle({ ...frame, event: "notification.read" }, signal);
  assert.equal(reloads, 3);
});
