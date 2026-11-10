import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ChatRepository } from "../../dist/modules/conversations/infrastructure/persistence/chat.repository.js";
import { systemMessageDraft } from "../../dist/modules/conversations/domain/system-message.js";
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
      await repository.advanceRead(conversationId, readerId, latest._id);
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
      const systemDraft = await repository.draft(
        systemMessageDraft(randomUUID(), {
          conversationId,
          senderId,
          messageText: "Thỏa thuận đã được chốt.",
          objectType: "LEARNING_PATH",
          objectId: randomUUID(),
          objectVersion: 1,
        }),
      );
      const repeated = await Promise.all(
        Array.from({ length: 3 }, () =>
          repository.publish(systemDraft._id, systemDraft.draftDigest),
        ),
      );
      assert.equal(new Set(repeated.map((m) => m.sequence.toString())).size, 1);
      const history = await repository.history(conversationId, 20);
      assert.equal(history.rows.length, 6);
      assert.equal(history.rows.at(-1).messageType, "SYSTEM");
      assert.equal(history.rows.at(-1).objectId, systemDraft.objectId);
    } finally {
      await connection.dropDatabase();
      await connection.close();
    }
  },
);
