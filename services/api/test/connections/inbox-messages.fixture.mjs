import assert from "node:assert/strict";
import { InboxMessageReader } from "../../dist/modules/conversations/application/services/inbox-message.reader.js";
import { InboxGroupsRepository } from "../../dist/modules/conversations/infrastructure/persistence/inbox-groups.repository.js";
import { inboxId, ownerId, senderId } from "./inbox-groups.fixture.mjs";

export const requestId = inboxId(5000);
export const group = {
  id: `request:${requestId}`,
  learningRequestId: requestId,
  conversationId: null,
};
export const principal = { userId: ownerId };
export function conversation(n, overrides = {}) {
  return {
    id: inboxId(n),
    requestId,
    participantAId: ownerId,
    participantBId: senderId,
    ...overrides,
  };
}
export function summary(row, overrides = {}) {
  return {
    conversationId: row.id,
    latestMessage: null,
    hasUnread: false,
    ...overrides,
  };
}
export function message(row, n, at = "2026-11-05T01:00:00.000Z") {
  return {
    id: inboxId(n),
    conversationId: row.id,
    senderId,
    messageType: "TEXT",
    preview: "Published text",
    sentAt: new Date(at),
  };
}

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((term) => matches(row, term));
    if (key === "AND") return value.every((term) => matches(row, term));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("gt" in value) return row[key] > value.gt;
      assert.fail(`Unsupported predicate: ${key}`);
    }
    return row[key] === value;
  });
}

/** Exercise the actual PG membership query builder with a small predicate evaluator. */
export function fixture(rows, read) {
  let inTransaction = false;
  let denied;
  const queries = [],
    batches = [];
  const tx = {
    conversation: {
      findMany: async (query) => {
        assert(inTransaction);
        queries.push(query);
        assert.deepEqual(query.select, { id: true, requestId: true });
        assert.deepEqual(query.orderBy, { id: "asc" });
        return rows
          .filter((row) => matches(row, query.where))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, query.take)
          .map(({ id, requestId }) => ({ id, requestId }));
      },
    },
  };
  const transactions = {
    run: async (work) => {
      assert(!inTransaction);
      inTransaction = true;
      try {
        return await work(tx);
      } finally {
        inTransaction = false;
      }
    },
  };
  const actors = {
    require: async (_tx, _principal, permission) => {
      assert(inTransaction);
      if (permission === denied) throw new Error("grant revoked");
    },
  };
  const chat = {
    read: async (ids, viewer) => {
      assert(!inTransaction, "Mongo I/O must not hold PostgreSQL locks");
      batches.push(ids);
      return read(ids, viewer);
    },
  };
  const reader = new InboxMessageReader(
    transactions,
    actors,
    new InboxGroupsRepository(),
    chat,
  );
  return {
    reader,
    transactions,
    actors,
    queries,
    batches,
    deny: (permission) => {
      denied = permission;
    },
  };
}
