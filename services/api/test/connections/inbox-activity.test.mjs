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
  const db = {
    conversation: {
      findMany: async ({ where, take }) =>
        rows.filter((row) => !where.id || row.id > where.id.gt).slice(0, take),
      updateMany: async ({ where, data }) => {
        const row = rows.find(
          (row) =>
            row.id === where.id && row.lastActivityAt < where.lastActivityAt.lt,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
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
  assert.deepEqual(
    rows.map((row) => row.lastActivityAt),
    [at(3), at(5), at(1)],
  );
  assert.deepEqual(await backfillChatActivity(db, mongo, 2), {
    scanned: 3,
    updated: 0,
  });
});
