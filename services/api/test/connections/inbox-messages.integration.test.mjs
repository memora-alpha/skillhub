import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose, { mongo } from "mongoose";
import { ChatRepository } from "../../dist/modules/conversations/infrastructure/persistence/chat.repository.js";
import { ChatInboxRepository } from "../../dist/modules/conversations/infrastructure/persistence/chat-inbox.repository.js";
import {
  fixture,
  conversation,
  principal,
  group,
} from "./inbox-messages.fixture.mjs";
import {
  inboxId,
  ownerId,
  senderId,
  thirdId,
} from "./inbox-groups.fixture.mjs";

test(
  "Mongo Inbox excludes drafts, honors viewer Long watermarks and aggregates every authorized chat",
  {
    skip:
      !process.env.TEST_MONGODB_URI &&
      "Set TEST_MONGODB_URI to an isolated replica set",
    timeout: 60000,
  },
  async () => {
    const dbName = `inbox_messages_test_${randomUUID().replaceAll("-", "")}`;
    const connection = await mongoose
      .createConnection(process.env.TEST_MONGODB_URI, {
        dbName,
        autoIndex: false,
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();
    try {
      const db = connection.db;
      assert((await db.admin().command({ hello: 1 })).setName);
      await db.collection("chat_messages").createIndexes([
        {
          key: { conversationId: 1, senderId: 1, clientMessageId: 1 },
          unique: true,
          name: "sender_identity",
        },
        {
          key: { conversationId: 1, sequence: 1 },
          unique: true,
          partialFilterExpression: { status: "PUBLISHED" },
          name: "published_sequence",
        },
        {
          key: { conversationId: 1, status: 1, sequence: -1 },
          name: "published_history",
        },
      ]);
      await db.createCollection("chat_read_states");
      await db.createCollection("chat_event_intents");
      const published = (id, chat, sequence, overrides = {}) => ({
        _id: inboxId(id),
        conversationId: inboxId(chat),
        senderId,
        clientMessageId: inboxId(id),
        status: "PUBLISHED",
        sequence: mongo.Long.fromString(sequence),
        sentAt: new Date("2026-11-05T01:00:00.000Z"),
        messageType: "TEXT",
        messageText: " Incoming   message ",
        attachments: [{ storageKey: "must-not-leak", checksum: "secret" }],
        ...overrides,
      });
      const incoming = published(1001, 1, "9007199254740993");
      const ownLatest = published(1002, 1, "9007199254740994", {
        senderId: ownerId,
        sentAt: new Date("2026-11-05T02:00:00.000Z"),
        messageText: "My latest message",
      });
      await db.collection("chat_messages").insertMany([
        incoming,
        ownLatest,
        published(1003, 2, "1", { messageType: "FILE", messageText: "" }),
        published(1004, 4, "1", {
          status: "DRAFT",
          sequence: null,
          sentAt: null,
        }),
        published(1005, 5, "1", { senderId: ownerId }),
        published(1006, 6, "1", {
          messageType: "SYSTEM",
          messageText: "  Lịch học đã chốt  ",
        }),
        published(1007, 1, "1", {
          status: "DRAFT",
          sequence: null,
          sentAt: null,
          messageText: "DO NOT SHOW DRAFT",
        }),
      ]);
      await db.collection("chat_read_states").insertMany([
        {
          _id: `${inboxId(1)}:${ownerId}`,
          conversationId: inboxId(1),
          userId: ownerId,
          lastReadSequence: mongo.Long.fromString("9007199254740992"),
          lastReadAt: new Date(),
          revision: 1,
        },
        {
          _id: `${inboxId(1)}:${senderId}`,
          conversationId: inboxId(1),
          userId: senderId,
          lastReadSequence: mongo.Long.fromString("9007199254740994"),
          lastReadAt: new Date(),
          revision: 1,
        },
      ]);
      const chat = new ChatRepository(connection);
      const repository = new ChatInboxRepository(connection, chat);
      const states = new Map(
        (await repository.read([1, 2, 3, 4, 5, 6].map(inboxId), ownerId)).map(
          (row) => [row.conversationId, row],
        ),
      );
      assert.equal(states.get(inboxId(1)).latestMessage.id, ownLatest._id);
      assert.equal(
        states.get(inboxId(1)).hasUnread,
        true,
        "own latest message must not clear earlier unread incoming",
      );
      assert.equal(
        states.get(inboxId(2)).latestMessage.preview,
        "Đã gửi một tệp",
      );
      assert.equal(states.get(inboxId(2)).hasUnread, true);
      for (const id of [3, 4]) {
        assert.equal(states.get(inboxId(id)).latestMessage, null);
        assert.equal(states.get(inboxId(id)).hasUnread, false);
      }
      assert.equal(states.get(inboxId(5)).hasUnread, false);
      assert.equal(states.get(inboxId(6)).hasUnread, true);
      assert.equal(
        states.get(inboxId(6)).latestMessage.preview,
        "Lịch học đã chốt",
      );
      assert(!JSON.stringify([...states.values()]).includes("must-not-leak"));
      assert(
        !JSON.stringify([...states.values()]).includes("DO NOT SHOW DRAFT"),
      );
      assert.equal(
        (await repository.read([inboxId(1)], senderId))[0].hasUnread,
        false,
        "other viewer has a separate watermark",
      );
      await chat.advanceRead(inboxId(1), ownerId, ownLatest._id);
      assert.equal(
        (await repository.read([inboxId(1)], ownerId))[0].hasUnread,
        false,
      );
      await db
        .collection("chat_messages")
        .insertOne(published(1008, 1, "9007199254740995"));
      assert.equal(
        (await repository.read([inboxId(1)], ownerId))[0].hasUnread,
        true,
      );

      // PG membership is evaluated by the real query builder against a fixture;
      // every Mongo lookup and Long/read-state operation above/below uses real Mongo.
      const rows = Array.from({ length: 205 }, (_, n) => conversation(n + 300));
      const last = rows.at(-1);
      const outsider = conversation(900, { participantAId: thirdId });
      await db.collection("chat_messages").insertMany([
        published(2000, 504, "1", {
          sentAt: new Date("2026-11-05T03:00:00.000Z"),
        }),
        published(2001, 900, "1", {
          sentAt: new Date("2026-11-05T04:00:00.000Z"),
          messageText: "Unauthorized message",
        }),
      ]);
      const f = fixture([...rows, outsider], (ids, viewer) =>
        repository.read(ids, viewer),
      );
      const summary = (await f.reader.read(principal, [group])).get(group.id);
      assert.equal(summary.latestMessage.conversationId, last.id);
      assert.equal(summary.hasUnread, true);
      assert.deepEqual(
        f.batches.map((batch) => batch.length),
        [100, 100, 5],
      );
      assert.equal(
        (
          await db
            .collection("chat_read_states")
            .findOne({ _id: `${inboxId(1)}:${ownerId}` })
        ).lastReadSequence.toString(),
        "9007199254740994",
        "Inbox GET must not advance reads",
      );
    } finally {
      assert.match(dbName, /^inbox_messages_test_[0-9a-f]{32}$/);
      await connection.dropDatabase();
      await connection.close();
    }
  },
);
