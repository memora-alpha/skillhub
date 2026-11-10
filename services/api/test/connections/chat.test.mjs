import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mongo } from "mongoose";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { ChatPublicationService } from "../../dist/modules/conversations/application/services/chat-publication.service.js";
import { enqueueSystemMessage } from "../../dist/modules/conversations/application/services/system-messages.js";
import { SystemMessagePublisher } from "../../dist/modules/conversations/application/services/system-message-publisher.js";
import {
  draftDigest,
  publicMessage,
} from "../../dist/modules/conversations/infrastructure/persistence/chat.repository.js";
import { connectionSettings } from "../../dist/modules/proposals/domain/connection-policy.js";
function fixture() {
  const principal = { userId: randomUUID() },
    conversation = {
      id: randomUUID(),
      lastActivityAt: new Date("2026-01-01T00:00:00.000Z"),
      participantAId: principal.userId,
      participantBId: randomUUID(),
    };
  const receipts = new Map(),
    messages = new Map(),
    events = [],
    outbox = [],
    notifications = [];
  let sequence = 0n,
    failDraft = false,
    failPublish = false,
    failAcknowledgement = false,
    revoked = false,
    inTransaction = false;
  const tx = {
    $queryRaw: async (strings) =>
      strings.join("").includes("clock_timestamp") ? [{ now: new Date() }] : [],
    conversation: {
      findUniqueOrThrow: async () => conversation,
      updateMany: async ({ where, data }) => {
        assert.equal(where.id, conversation.id);
        if (conversation.lastActivityAt < where.lastActivityAt.lt) {
          conversation.lastActivityAt = data.lastActivityAt;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    chatPublication: {
      findUnique: async ({ where }) =>
        where.id
          ? receipts.get(where.id)
          : [...receipts.values()].find(
              (row) =>
                row.clientMessageId ===
                where.conversationId_senderId_clientMessageId.clientMessageId,
            ),
      findUniqueOrThrow: async ({ where }) => {
        const row = receipts.get(where.id);
        assert(row);
        return row;
      },
      create: async ({ data }) => {
        const row = {
          status: "PREPARING",
          createdAt: new Date(),
          draftDigest: null,
          ...data,
        };
        receipts.set(row.id, row);
        return row;
      },
      count: async () => 0,
      update: async ({ where, data }) => {
        const next = { ...receipts.get(where.id), ...data };
        receipts.set(where.id, next);
        return next;
      },
      updateMany: async ({ where, data }) => {
        if (failAcknowledgement && data.status === "DELIVERED") {
          failAcknowledgement = false;
          throw new Error("crash after Mongo commit");
        }
        const row = receipts.get(where.id);
        if (!row || row.status !== where.status) return { count: 0 };
        receipts.set(where.id, { ...row, ...data });
        return { count: 1 };
      },
    },
  };
  tx.outboxEvent = {
    create: async ({ data }) => {
      outbox.push(data);
      return data;
    },
  };
  const transactions = {
    run: async (work) => {
      const before = structuredClone(receipts);
      inTransaction = true;
      try {
        return await work(tx);
      } catch (error) {
        receipts.clear();
        for (const [key, value] of before) receipts.set(key, value);
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
  const chat = {
    ready: async () => {},
    get: async (id) => {
      assert(!inTransaction, "Mongo read must not occur inside PG transaction");
      return messages.get(id);
    },
    draft: async (input) => {
      assert(!inTransaction);
      if (failDraft) {
        failDraft = false;
        throw new Error("Mongo unavailable before draft");
      }
      const existing = messages.get(input._id);
      if (existing) {
        if (
          existing.commandDigest !== input.commandDigest ||
          draftDigest(existing) !== existing.draftDigest
        )
          throw new Error("MESSAGE_DRAFT_CONFLICT");
        return existing; // Match the real repository's immutable $setOnInsert.
      }
      const row = {
        ...input,
        draftDigest: draftDigest(input),
        status: "DRAFT",
        sequence: null,
        sentAt: null,
      };
      messages.set(row._id, row);
      return row;
    },
    publish: async (id, digest) => {
      assert(!inTransaction);
      if (failPublish) throw new Error("Mongo unavailable during publication");
      const row = messages.get(id);
      if (!row || row.draftDigest !== digest)
        throw new Error("COMMITTED_DRAFT_MISSING_OR_CHANGED");
      if (row.status === "PUBLISHED") return row;
      const published = {
        ...row,
        status: "PUBLISHED",
        sequence: mongo.Long.fromString((++sequence).toString()),
        sentAt: new Date(),
      };
      messages.set(id, published);
      return published;
    },
    pendingIntents: async () => [],
  };
  const eventsService = {
    lockRecipients: async () => {},
    append: async (_tx, users, source, type, payload) =>
      events.push({ users, source, type, payload }),
  };
  const publisher = new ChatPublicationService(
    tx,
    transactions,
    chat,
    eventsService,
    { register() {} },
    { createChat: async (_tx, input) => notifications.push(input) },
  );
  const access = {
    require: async () => {
      if (revoked) throw new Error("session revoked");
      return { conversation, actor: { userId: principal.userId } };
    },
  };
  const service = new ConversationsService(
    tx,
    transactions,
    access,
    {},
    { policy: connectionSettings({}) },
    chat,
    publisher,
    { chatManifest: async () => [] },
    {},
    { append: async (_tx, event) => outbox.push(event) },
  );
  const input = { clientMessageId: randomUUID(), messageText: "Hello" },
    context = { correlationId: randomUUID() };
  return {
    tx,
    chat,
    transactions,
    service,
    publisher,
    principal,
    conversation,
    input,
    context,
    receipts,
    messages,
    events,
    outbox,
    notifications,
    get sequence() {
      return sequence;
    },
    failDraft() {
      failDraft = true;
    },
    failPublish(value) {
      failPublish = value;
    },
    failAcknowledgement() {
      failAcknowledgement = true;
    },
    revokeDuringMongoRead() {
      const get = chat.get;
      chat.get = async (...args) => {
        const message = await get(...args);
        revoked = true;
        return message;
      };
    },
  };
}
test("durable PREPARING identity survives missing draft and same-body retry; conflicting body fails", async () => {
  const f = fixture();
  f.failDraft();
  await assert.rejects(
    f.service.send(f.principal, f.conversation.id, f.input, f.context),
    /Mongo unavailable/,
  );
  assert.equal([...f.receipts.values()][0].status, "PREPARING");
  const result = await f.service.send(
    f.principal,
    f.conversation.id,
    f.input,
    f.context,
  );
  assert.equal(result.deliveryStatus, "DELIVERED");
  assert.equal(f.receipts.size, 1);
  await assert.rejects(
    f.service.send(
      f.principal,
      f.conversation.id,
      { ...f.input, messageText: "Different" },
      f.context,
    ),
    /MESSAGE_IDEMPOTENCY_CONFLICT/,
  );
  assert.equal(f.sequence, 1n);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0].userId, f.conversation.participantBId);
});

test("system message recovers Mongo outages and post-commit crash without duplicate history, SSE or notification", async () => {
  const f = fixture();
  const input = {
    conversationId: f.conversation.id,
    senderId: f.principal.userId,
    messageText: "An đã xác nhận lịch Bình dạy An. Đang chờ Bình xác nhận.",
    objectType: "SCHEDULE_PROPOSAL",
    objectId: randomUUID(),
    objectVersion: 2,
  };
  const messageId = await f.transactions.run((tx) =>
    enqueueSystemMessage(tx, input),
  );
  assert.equal(f.messages.size, 0, "no Mongo I/O in business transaction");
  assert.equal(f.events.length, 0);
  const event = f.outbox[0];
  const registered = new Map();
  const system = new SystemMessagePublisher(
    { register: (type, publisher) => registered.set(type, publisher) },
    f.tx,
    f.chat,
    f.publisher,
  );
  system.onModuleInit();
  assert.equal(registered.get("chat.system.publish"), system);
  f.failDraft();
  await assert.rejects(system.publish(event), /Mongo unavailable before draft/);
  f.failPublish(true);
  await assert.rejects(
    system.publish(event),
    /Mongo unavailable during publication/,
  );
  assert.equal(f.receipts.get(messageId).status, "COMMITTED");
  f.failPublish(false);
  f.failAcknowledgement();
  await assert.rejects(system.publish(event), /crash after Mongo commit/);
  assert.equal(f.messages.get(messageId).status, "PUBLISHED");
  assert.equal(f.receipts.get(messageId).status, "COMMITTED");
  await Promise.all([system.publish(event), system.publish(event)]);
  await system.publish(event);
  assert.equal(f.messages.size, 1);
  assert.equal(f.sequence, 1n);
  assert.equal(f.receipts.get(messageId).status, "DELIVERED");
  assert.equal(
    f.notifications.length,
    0,
    "domain notification handles the action",
  );
  assert.deepEqual(
    f.events.map((e) => e.type),
    ["chat.message.created"],
  );
  assert.deepEqual(f.events[0].users, [
    f.conversation.participantAId,
    f.conversation.participantBId,
  ]);
  assert.equal(f.conversation.lastActivityAt, f.messages.get(messageId).sentAt);
  const view = publicMessage(f.messages.get(messageId));
  assert.equal(view.messageType, "SYSTEM");
  assert.equal(view.messageText, input.messageText);
  assert.equal(view.objectVersion, 2);
  assert.equal(view.objectId, input.objectId);
});

test("system message snapshots cannot overwrite committed content; failed enqueue rolls back its receipt", async () => {
  const f = fixture();
  await f.transactions.run((tx) =>
    enqueueSystemMessage(tx, {
      conversationId: f.conversation.id,
      senderId: f.principal.userId,
      messageText: "Thỏa thuận đã được chốt.",
      objectType: "LEARNING_PATH",
      objectId: randomUUID(),
      objectVersion: 1,
    }),
  );
  const system = new SystemMessagePublisher(
    { register() {} },
    f.tx,
    f.chat,
    f.publisher,
  );
  const event = f.outbox[0];
  for (const invalid of [
    { ...event, eventId: randomUUID() },
    { ...event, version: 2 },
    { ...event, payload: { ...event.payload, messageText: "changed" } },
    {
      ...event,
      payload: { ...event.payload, senderId: f.conversation.participantBId },
    },
    { ...event, payload: { ...event.payload, messageType: "TEXT" } },
  ])
    await assert.rejects(system.publish(invalid));
  assert.equal(f.messages.size, 0);
  const receiptsBefore = f.receipts.size;
  f.tx.outboxEvent.create = async () => {
    throw new Error("outbox unavailable");
  };
  await assert.rejects(
    f.transactions.run((tx) =>
      enqueueSystemMessage(tx, {
        conversationId: f.conversation.id,
        senderId: f.principal.userId,
        messageText: "Thỏa thuận đã được chốt.",
        objectType: "LEARNING_PATH",
        objectId: randomUUID(),
        objectVersion: 1,
      }),
    ),
    /outbox unavailable/,
  );
  assert.equal(f.receipts.size, receiptsBefore);
});
test("COMMITTED worker retry after Mongo publication keeps original sequence and emits once", async () => {
  const f = fixture();
  f.failPublish(true);
  const pending = await f.service.send(
    f.principal,
    f.conversation.id,
    f.input,
    f.context,
  );
  assert.equal(pending.deliveryStatus, "PENDING");
  assert.equal(f.outbox.length, 1);
  assert.equal(f.events.length, 0);
  f.failPublish(false);
  f.failAcknowledgement();
  await assert.rejects(
    f.publisher.deliver(pending.messageId),
    /crash after Mongo commit/,
  );
  const first = f.messages.get(pending.messageId);
  assert.equal(first.status, "PUBLISHED");
  assert.equal([...f.receipts.values()][0].status, "COMMITTED");
  const recovered = await f.publisher.deliver(pending.messageId);
  assert.equal(recovered.sequence.toString(), first.sequence.toString());
  assert.equal(recovered.sentAt, first.sentAt);
  assert.equal(f.conversation.lastActivityAt, first.sentAt);
  const newer = new Date(first.sentAt.getTime() + 60000);
  f.conversation.lastActivityAt = newer;
  await f.publisher.deliver(pending.messageId);
  assert.equal(f.conversation.lastActivityAt, newer);
  assert.equal(f.sequence, 1n);
  assert.equal(
    f.events.filter((event) => event.type === "chat.message.created").length,
    1,
  );
  assert.equal(
    f.events.filter((event) => event.type === "chat.delivery.updated").length,
    1,
  );
});
test("delivery rechecks live access after Mongo I/O before returning private content", async () => {
  const f = fixture();
  await f.service.send(f.principal, f.conversation.id, f.input, f.context);
  f.revokeDuringMongoRead();
  await assert.rejects(
    f.service.delivery(f.principal, f.conversation.id, f.input.clientMessageId),
    /session revoked/,
  );
});
test("missing committed draft never fabricates content or marks delivery", async () => {
  const f = fixture();
  f.failPublish(true);
  const pending = await f.service.send(
    f.principal,
    f.conversation.id,
    f.input,
    f.context,
  );
  f.messages.clear();
  f.failPublish(false);
  await assert.rejects(
    f.publisher.deliver(pending.messageId),
    /COMMITTED_DRAFT_MISSING/,
  );
  assert.equal([...f.receipts.values()][0].status, "COMMITTED");
  assert.equal(f.sequence, 0n);
});
test("public messages expose string Long and remove internal file metadata", () => {
  const message = {
    _id: randomUUID(),
    conversationId: randomUUID(),
    senderId: randomUUID(),
    messageText: "Text",
    messageType: "FILE",
    attachments: [
      {
        attachmentId: randomUUID(),
        fileId: randomUUID(),
        generation: 2,
        filename: "safe.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        storageKey: "must not leak",
        checksum: "must not leak",
      },
    ],
    sequence: mongo.Long.fromString("9007199254740993"),
    sentAt: new Date(),
  };
  const view = publicMessage(message);
  assert.equal(view.sequence, "9007199254740993");
  assert.doesNotMatch(
    JSON.stringify(view),
    /must not leak|checksum|storageKey|generation/,
  );
});
