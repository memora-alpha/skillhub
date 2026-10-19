import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mongo } from "mongoose";
import { ConversationsService } from "../../dist/modules/conversations/application/conversations.service.js";
import { ChatPublicationService } from "../../dist/modules/conversations/application/chat-publication.service.js";
import {
  draftDigest,
  publicMessage,
} from "../../dist/modules/conversations/infrastructure/chat.repository.js";
import { connectionSettings } from "../../dist/modules/proposals/domain/connection-policy.js";
function fixture() {
  const principal = { userId: randomUUID() },
    conversation = {
      id: randomUUID(),
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
    conversation: { findUniqueOrThrow: async () => conversation },
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
          ...data,
          status: "PREPARING",
          createdAt: new Date(),
          draftDigest: null,
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
  await f.publisher.deliver(pending.messageId);
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
