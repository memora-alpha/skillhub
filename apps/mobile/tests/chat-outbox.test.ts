import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import { TextOutbox } from "../src/features/messages/outbox/text-outbox";
import type {
  Delivery,
  MessageDraft,
} from "../src/features/messages/api/messages-api";
import {
  chatId,
  ownerId,
  outboxHarness,
  published,
  settle,
  deferred,
  memoryOutbox,
} from "./fixtures/chat-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";

test("offline sends appear immediately, persist before POST, and drain in order on reconnect", async (t) => {
  const posted: MessageDraft[] = [];
  const h = outboxHarness({
    send: async (_id, body) => {
      assert.ok(h.data.box.raw?.includes(body.clientMessageId));
      assert.equal(
        JSON.parse(h.data.box.raw!).items.find(
          (e: MessageDraft) => e.clientMessageId === body.clientMessageId,
        ).phase,
        "check",
      );
      posted.push(body);
      return {
        deliveryStatus: "DELIVERED",
        message: published(body, posted.length),
      };
    },
    delivery: async () => {
      throw new AppError("http", 404);
    },
  });
  t.after(() => h.store.stop());
  h.store.setConnection(false);
  await h.store.start();
  assert.equal(h.store.enqueue(chatId, "Tin nhắn thứ nhất"), true);
  assert.equal(h.store.enqueue(chatId, "Tin nhắn thứ hai"), true);
  assert.equal(h.store.getSnapshot().items.length, 2);
  await settle();
  assert.equal(posted.length, 0);
  h.store.setConnection(true);
  await settle();
  assert.deepEqual(
    posted.map((body) => body.messageText),
    ["Tin nhắn thứ nhất", "Tin nhắn thứ hai"],
  );
  assert.equal(new Set(posted.map((body) => body.clientMessageId)).size, 2);
  assert.equal(h.confirmed.length, 2);
  assert.deepEqual(JSON.parse(h.data.box.raw!).items, []);
});

test("slow sends keep multiple bubbles queued and never start parallel POSTs in one conversation", async (t) => {
  const first = deferred<Delivery>();
  const posted: MessageDraft[] = [];
  const h = outboxHarness({
    send: async (_id, body) => {
      posted.push(body);
      return posted.length === 1
        ? first.promise
        : { deliveryStatus: "DELIVERED", message: published(body, 2) };
    },
    delivery: async () => {
      throw new AppError("http", 404);
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Một");
  await settle();
  h.store.enqueue(chatId, "Hai");
  await settle();
  assert.equal(h.store.getSnapshot().items.length, 2);
  assert.equal(posted.length, 1);
  first.resolve({
    deliveryStatus: "DELIVERED",
    message: published(posted[0]!),
  });
  await settle();
  assert.equal(posted.length, 2);
  assert.equal(h.confirmed.length, 2);
});

test("lost POST response reconciles the same client ID without duplicating an accepted message", async (t) => {
  let saved: MessageDraft | undefined,
    posts = 0,
    checks = 0;
  const h = outboxHarness({
    send: async (_id, body) => {
      saved = body;
      posts++;
      throw new AppError("network");
    },
    delivery: async (_id, clientId) => {
      checks++;
      assert.equal(clientId, saved!.clientMessageId);
      return { deliveryStatus: "DELIVERED", message: published(saved!) };
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Giữ nguyên mã tin này");
  await settle();
  assert.equal(h.store.getSnapshot().items[0]!.state, "queued");
  h.advance();
  await settle();
  assert.equal(posts, 1);
  assert.equal(checks, 1);
  assert.equal(h.confirmed.length, 1);
});

test("a request that never arrived retries its exact immutable body after delivery 404", async (t) => {
  const bodies: MessageDraft[] = [];
  const h = outboxHarness({
    send: async (_id, body) => {
      bodies.push(body);
      if (bodies.length === 1) throw new AppError("network");
      return { deliveryStatus: "DELIVERED", message: published(body) };
    },
    delivery: async () => {
      throw new AppError("http", 404);
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Mạng chập chờn");
  await settle();
  h.advance();
  await settle();
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[1], bodies[0]);
  assert.equal(h.confirmed.length, 1);
});

test("PENDING remains unconfirmed, then polls to DELIVERED without another POST", async (t) => {
  let body!: MessageDraft,
    posts = 0,
    checks = 0;
  const pending = (): Delivery => ({
    deliveryStatus: "PENDING",
    messageId: fixtureId(701),
    clientMessageId: body.clientMessageId,
    statusUrl: "/unused",
    failureCode: null,
  });
  const h = outboxHarness({
    send: async (_id, draft) => {
      body = draft;
      posts++;
      return pending();
    },
    delivery: async () =>
      ++checks === 1
        ? pending()
        : { deliveryStatus: "DELIVERED", message: published(body) },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Đợi xác nhận từ máy chủ");
  await settle();
  assert.equal(h.confirmed.length, 0);
  assert.equal(h.store.getSnapshot().items[0]!.state, "processing");
  h.advance();
  await settle();
  assert.equal(h.confirmed.length, 0);
  h.advance();
  await settle();
  assert.equal(h.confirmed.length, 1);
  assert.equal(posts, 1);
});

for (const stage of ["PREPARING", "publication-failed"] as const)
  test(`${stage} resumes publication with the same client ID and body`, async (t) => {
    const bodies: MessageDraft[] = [];
    const pending = (): Delivery => ({
      deliveryStatus: stage === "PREPARING" ? "PREPARING" : "PENDING",
      messageId: fixtureId(701),
      clientMessageId: bodies[0]!.clientMessageId,
      statusUrl: "/unused",
      failureCode:
        stage === "publication-failed"
          ? "CHAT_PUBLICATION_RETRY_REQUIRED"
          : null,
    });
    const h = outboxHarness({
      send: async (_id, body) => {
        bodies.push(body);
        return bodies.length === 1
          ? pending()
          : { deliveryStatus: "DELIVERED", message: published(body) };
      },
      delivery: async () => pending(),
    });
    t.after(() => h.store.stop());
    await h.store.start();
    h.store.enqueue(chatId, "Tiếp tục gửi tin");
    await settle();
    h.advance();
    await settle();
    assert.equal(bodies.length, 2);
    assert.deepEqual(bodies[1], bodies[0]);
    assert.equal(h.confirmed.length, 1);
  });

test("restoring a pending queue reconciles after restart and isolates account/API scope", async (t) => {
  const data = memoryOutbox();
  const h = outboxHarness(
    {
      send: async () => {
        throw new AppError("network");
      },
      delivery: async () => {
        throw new AppError("http", 404);
      },
    },
    data,
  );
  await h.store.start();
  h.store.enqueue(chatId, "Không mất tin đang chờ");
  await settle();
  h.store.stop();
  let posts = 0;
  const recovered = new TextOutbox({
    ...h.options,
    api: {
      send: async () => {
        posts++;
        throw Error("must reconcile first");
      },
      delivery: async (_id, clientId) => {
        assert.equal(clientId, fixtureId(801));
        return {
          deliveryStatus: "DELIVERED",
          message: published({
            clientMessageId: clientId,
            messageText: "Không mất tin đang chờ",
          }),
        };
      },
    },
  });
  t.after(() => recovered.stop());
  recovered.setConnection(false);
  await recovered.start();
  await settle();
  assert.equal(
    recovered.getSnapshot().items[0]!.messageText,
    "Không mất tin đang chờ",
  );
  recovered.setConnection(true);
  await settle();
  assert.equal(posts, 0);
  data.box.raw = JSON.stringify({
    version: 1,
    ownerId,
    scope: h.options.scope,
    items: [],
  });
  for (const scope of [
    { ownerId: fixtureId(2) },
    { scope: "https://different.test" },
  ]) {
    const wrong = new TextOutbox({ ...h.options, ...scope });
    t.after(() => wrong.stop());
    await wrong.start();
    assert.equal(wrong.getSnapshot().ready, false);
    assert.ok(wrong.getSnapshot().error);
  }
});

test("logout stops queued sends and late responses cannot change the next account", async (t) => {
  const response = deferred<Delivery>();
  let body!: MessageDraft,
    posts = 0;
  const h = outboxHarness({
    send: async (_id, draft) => {
      body = draft;
      posts++;
      return response.promise;
    },
    delivery: async () => {
      throw new AppError("http", 404);
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Tin của tài khoản cũ");
  await settle();
  h.store.enqueue(chatId, "Tin thứ hai");
  await settle();
  h.stale();
  h.store.stop();
  response.resolve({ deliveryStatus: "DELIVERED", message: published(body) });
  await settle();
  assert.equal(posts, 1);
  assert.equal(h.confirmed.length, 0);
  assert.equal(h.store.enqueue(chatId, "Không được gửi nữa"), false);
});

for (const status of [400, 403, 409])
  test(`HTTP ${status} keeps a failed bubble and requires explicit retry`, async (t) => {
    const bodies: MessageDraft[] = [];
    let fail = true;
    const h = outboxHarness({
      send: async (_id, body) => {
        bodies.push(body);
        if (fail) throw new AppError("http", status);
        return { deliveryStatus: "DELIVERED", message: published(body) };
      },
      delivery: async () => {
        throw new AppError("http", 404);
      },
    });
    t.after(() => h.store.stop());
    await h.store.start();
    h.store.enqueue(chatId, "Giữ lại để thử lại");
    await settle();
    assert.equal(h.store.getSnapshot().items[0]!.state, "failed");
    h.advance();
    await settle();
    assert.equal(bodies.length, 1);
    fail = false;
    h.store.retry(bodies[0]!.clientMessageId);
    await settle();
    assert.deepEqual(bodies[1], bodies[0]);
  });

test("storage failure retains the bubble and prevents a network write", async (t) => {
  let posts = 0;
  const h = outboxHarness({
    send: async () => {
      posts++;
      throw Error("unexpected");
    },
    delivery: async () => {
      throw Error("unexpected");
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.data.box.fail = true;
  h.store.enqueue(chatId, "Tin phải được lưu trước");
  await settle();
  assert.equal(posts, 0);
  assert.equal(h.store.getSnapshot().items[0]!.state, "failed");
  assert.equal(
    h.store.getSnapshot().items[0]!.messageText,
    "Tin phải được lưu trước",
  );
});

test("cleanup failure cannot turn a server-confirmed delivery back into a failed message", async (t) => {
  const h = outboxHarness({
    send: async (_id, body) => {
      h.data.box.fail = true;
      return { deliveryStatus: "DELIVERED", message: published(body) };
    },
    delivery: async () => {
      throw Error("unexpected");
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Máy chủ đã nhận");
  await settle();
  assert.equal(h.store.getSnapshot().items[0]!.state, "sent");
  assert.equal(h.confirmed.length, 1);
});

for (const status of [429, 503])
  test(`HTTP ${status} retries automatically with the same client ID`, async (t) => {
    const bodies: MessageDraft[] = [];
    const h = outboxHarness({
      send: async (_id, body) => {
        bodies.push(body);
        if (bodies.length === 1) throw new AppError("http", status);
        return { deliveryStatus: "DELIVERED", message: published(body) };
      },
      delivery: async () => {
        throw new AppError("http", 404);
      },
    });
    t.after(() => h.store.stop());
    await h.store.start();
    h.store.enqueue(chatId, "Đợi mạng hoặc máy chủ sẵn sàng");
    await settle();
    assert.equal(h.store.getSnapshot().items[0]!.state, "queued");
    h.advance();
    await settle();
    assert.equal(h.confirmed.length, 1);
    assert.deepEqual(bodies[1], bodies[0]);
  });

test("background pauses requests; foreground resumes the same queued intent", async (t) => {
  const bodies: MessageDraft[] = [];
  const h = outboxHarness({
    send: async (_id, body, signal) => {
      bodies.push(body);
      if (bodies.length === 1)
        return new Promise<Delivery>((_resolve, reject) =>
          signal!.addEventListener(
            "abort",
            () => reject(new AppError("session")),
            { once: true },
          ),
        );
      return { deliveryStatus: "DELIVERED", message: published(body) };
    },
    delivery: async () => {
      throw new AppError("http", 404);
    },
  });
  t.after(() => h.store.stop());
  await h.store.start();
  h.store.enqueue(chatId, "Giữ tin khi chuyển ứng dụng");
  await settle();
  h.store.setConnection(true, false);
  await settle();
  h.advance();
  await settle();
  assert.equal(bodies.length, 1);
  h.store.setConnection(true, true);
  await settle();
  assert.equal(h.confirmed.length, 1);
  assert.deepEqual(bodies[1], bodies[0]);
});
