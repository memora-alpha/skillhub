import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ChatRepository } from "../../dist/modules/conversations/infrastructure/persistence/chat.repository.js";
const uri = process.env.TEST_MONGODB_URI;
test(
  "real replica set publishes each draft once and advances monotonic read with durable event intent",
  {
    skip: !uri && "Set TEST_MONGODB_URI to an isolated replica set",
    timeout: 120000,
  },
  async () => {
    const dbName = `connections_test_${randomUUID().replaceAll("-", "")}`;
    const connection = await mongoose
      .createConnection(uri, {
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
          name: "sender_identity",
          unique: true,
        },
        {
          key: { conversationId: 1, sequence: 1 },
          name: "published_sequence",
          unique: true,
          partialFilterExpression: { status: "PUBLISHED" },
        },
      ]);
      await db.createCollection("chat_counters");
      await db.createCollection("chat_read_states");
      await db.createCollection("chat_event_intents");
      const repository = new ChatRepository(connection),
        conversationId = randomUUID(),
        senderId = randomUUID(),
        readerId = randomUUID();
      const drafts = [];
      for (let index = 0; index < 5; index++)
        drafts.push(
          await repository.draft({
            _id: randomUUID(),
            conversationId,
            senderId,
            clientMessageId: randomUUID(),
            messageText: `message ${index}`,
            messageType: "TEXT",
            attachments: [],
            commandDigest: randomUUID(),
            draftFormatVersion: 1,
          }),
        );
      assert.equal(
        (await repository.history(conversationId, 20)).rows.length,
        0,
      );
      const published = await Promise.all(
        drafts.map((draft) => repository.publish(draft._id, draft.draftDigest)),
      );
      assert.equal(
        new Set(published.map((row) => row.sequence.toString())).size,
        5,
      );
      const first = published[0],
        retry = await repository.publish(first._id, first.draftDigest);
      assert.equal(retry.sequence.toString(), first.sequence.toString());
      assert.deepEqual(retry.sentAt, first.sentAt);
      const ordered = (await repository.history(conversationId, 20)).rows;
      const latest = ordered.at(-1);
      const emptyId = randomUUID();
      const preview = await repository.inboxSummaries(
        [conversationId, emptyId],
        readerId,
      );
      assert.equal(preview.get(conversationId).unreadCount, 5);
      assert.equal(preview.get(conversationId).lastMessage.id, latest._id);
      assert.equal(preview.get(emptyId).lastMessage, null);
      assert.equal(preview.get(emptyId).unreadCount, 0);
      const own = await repository.draft({
        _id: randomUUID(),
        conversationId,
        senderId: readerId,
        clientMessageId: randomUUID(),
        messageText: "own message",
        messageType: "TEXT",
        attachments: [],
        commandDigest: randomUUID(),
        draftFormatVersion: 1,
      });
      assert.equal(
        (await repository.inboxSummaries([conversationId], readerId)).get(
          conversationId,
        ).unreadCount,
        5,
      );
      await repository.publish(own._id, own.draftDigest);
      const ownPreview = (
        await repository.inboxSummaries([conversationId], readerId)
      ).get(conversationId);
      assert.equal(ownPreview.unreadCount, 5);
      assert.equal(ownPreview.lastMessage.id, own._id);
      assert(!("attachments" in ownPreview.lastMessage));
      await repository.advanceRead(conversationId, readerId, latest._id);
      assert.equal(
        (await repository.inboxSummaries([conversationId], readerId)).get(
          conversationId,
        ).unreadCount,
        0,
      );
      await repository.advanceRead(conversationId, readerId, ordered[0]._id);
      assert.equal(
        (
          await repository.readState(conversationId, readerId)
        ).lastReadSequence.toString(),
        latest.sequence.toString(),
      );
      assert.equal((await repository.pendingIntents()).length, 1);
      assert.equal(
        await repository.advanceRead(randomUUID(), readerId, latest._id),
        null,
      );
    } finally {
      await connection.dropDatabase();
      await connection.close();
    }
  },
);
