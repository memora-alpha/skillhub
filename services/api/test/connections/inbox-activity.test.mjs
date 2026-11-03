import assert from "node:assert/strict";
import { test } from "node:test";
import { backfillChatActivity } from "../../scripts/lib/chat-activity-backfill.mjs";

test("activity backfill pages all chats, skips empty history and never overwrites newer delivery", async () => {
  const at = (day) =>
    new Date(`2026-11-${String(day).padStart(2, "0")}T00:00:00.000Z`);
  const rows = [1, 2, 3].map((id) => ({
    id: String(id),
    lastActivityAt: at(1),
  }));
  rows[1].lastActivityAt = at(5);
  const batches = [];
  const db = {
    conversation: {
      findMany: async ({ where, take }) =>
        rows.filter((row) => !where.id || row.id > where.id.gt).slice(0, take),
    },
    $executeRaw: async (sql) => {
      batches.push(sql.values);
      let count = 0;
      for (let index = 0; index < sql.values.length; index += 2) {
        const id = sql.values[index],
          sentAt = sql.values[index + 1];
        const row = rows.find(
          (row) => row.id === id && row.lastActivityAt < sentAt,
        );
        if (row) {
          row.lastActivityAt = sentAt;
          count++;
        }
      }
      return count;
    },
  };
  const mongo = {
    aggregate: (pipeline) => ({
      toArray: async () =>
        pipeline[0].$documents.map(({ _id }) => ({
          _id,
          last: _id === "3" ? [] : [{ sentAt: at(3) }],
        })),
    }),
  };
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 3,
    updated: 1,
  });
  assert.equal(batches.length, 1, "one SQL batch for both nonempty histories");
  assert.equal(batches[0].length, 4);
  assert.deepEqual(
    rows.map((row) => row.lastActivityAt),
    [at(3), at(5), at(1)],
  );
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 3,
    updated: 0,
  });
});

test("backfill validates the whole page before writing and stops on an incomplete Mongo batch", async () => {
  await Promise.all(
    [
      [{ _id: "1", last: [{ sentAt: new Date() }] }],
      [
        { _id: "1", last: [{ sentAt: new Date() }] },
        { _id: "2", last: [{ sentAt: "invalid" }] },
      ],
    ].map(async (summaries) => {
      let writes = 0;
      const db = {
        conversation: { findMany: async () => [{ id: "1" }, { id: "2" }] },
        $executeRaw: async () => {
          writes++;
          return 1;
        },
      };
      const mongo = { aggregate: () => ({ toArray: async () => summaries }) };
      await assert.rejects(
        backfillChatActivity(db, mongo, 2),
        /INCOMPLETE_CHAT_ACTIVITY_BATCH|INVALID_PUBLISHED_MESSAGE_TIME/,
      );
      assert.equal(writes, 0);
    }),
  );
});

test("failed SQL batch never advances to the next keyset page", async () => {
  let reads = 0;
  const db = {
    conversation: {
      findMany: async () => {
        reads++;
        return [{ id: "1" }];
      },
    },
    $executeRaw: async () => {
      throw new Error("batch write failed");
    },
  };
  const mongo = {
    aggregate: () => ({
      toArray: async () => [{ _id: "1", last: [{ sentAt: new Date() }] }],
    }),
  };
  await assert.rejects(
    backfillChatActivity(db, mongo, 1),
    /batch write failed/,
  );
  assert.equal(reads, 1);
});
