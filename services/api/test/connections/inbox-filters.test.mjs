import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ProposalsService } from "../../dist/modules/proposals/application/services/proposals.service.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { inboxId, ownerId, senderId } from "./inbox-groups.fixture.mjs";

test("sent Request history retains status, pagination and title without owner/public-detail access", async () => {
  const requestId = inboxId(1);
  let query;
  const rows = [2, 3].map((n) => ({
    id: inboxId(n),
    requestId,
    proposerId: senderId,
    recipientId: ownerId,
    proposedCredit: null,
  }));
  const tx = {
    proposal: {
      findMany: async (args) => {
        query = args;
        return args.where.id ? [] : rows;
      },
    },
  };
  const requests = {
    proposalSource: async () => ({ ownerId }),
    inboxMetadata: async (_tx, viewer, ids) => {
      assert.equal(viewer, senderId);
      assert.deepEqual(ids, ids.length ? [requestId] : []);
      return new Map([[requestId, { title: "Closed Request", ownerId }]]);
    },
  };
  const service = new ProposalsService(
    tx,
    { run: (work) => work(tx) },
    {},
    { require: async () => {} },
    {},
    requests,
  );
  const filter = {
    direction: "sent",
    learningRequestId: requestId,
    status: "WITHDRAWN",
    limit: 1,
  };
  const result = await service.list({ userId: senderId }, filter);
  assert.equal(query.where.proposerId, senderId);
  assert.equal(query.where.recipientId, undefined);
  assert.equal(query.where.requestId, requestId);
  assert.equal(query.where.status, "WITHDRAWN");
  assert.deepEqual(query.orderBy, { id: "asc" });
  assert.equal(result.data[0].learningRequestTitle, "Closed Request");
  assert.equal(result.pagination.hasMore, true);
  await service.list(
    { userId: senderId },
    { ...filter, cursor: result.pagination.nextCursor },
  );
  assert.deepEqual(query.where.id, { gt: rows[0].id });
  await assert.rejects(
    service.list(
      { userId: senderId },
      { ...filter, status: "REJECTED", cursor: result.pagination.nextCursor },
    ),
    /INVALID_CURSOR/,
  );
  for (const direction of [undefined, "received"])
    await assert.rejects(
      service.list({ userId: senderId }, { ...filter, direction }),
      (error) => error.getStatus() === 404,
    );
});

test("child chat filter retains participant membership and existing unfiltered cursor scope", async () => {
  let query;
  const tx = {
    conversation: {
      findMany: async (args) => {
        query = args;
        return [2, 3].map((n) => ({
          id: inboxId(n),
          requestId: inboxId(1),
          participantAId: senderId,
          participantBId: ownerId,
        }));
      },
    },
  };
  const service = new ConversationsService(
    tx,
    { run: (work) => work(tx) },
    {},
    { require: async () => {} },
  );
  const principal = { userId: senderId };
  const filtered = await service.list(principal, {
    learningRequestId: inboxId(1),
    limit: 1,
  });
  assert.equal(query.where.requestId, inboxId(1));
  assert.deepEqual(query.where.OR, [
    { participantAId: senderId },
    { participantBId: senderId },
  ]);
  assert.equal(filtered.data[0].learningRequestId, inboxId(1));
  await assert.rejects(
    service.list(principal, {
      learningRequestId: inboxId(9),
      cursor: filtered.pagination.nextCursor,
    }),
    /INVALID_CURSOR/,
  );
  await assert.rejects(
    service.list(principal, { cursor: filtered.pagination.nextCursor }),
    /INVALID_CURSOR/,
  );
  const flat = await service.list(principal, { limit: 1 });
  assert.equal(query.where.requestId, undefined);
  await service.list(principal, { cursor: flat.pagination.nextCursor });
  assert.deepEqual(query.where.id, { gt: inboxId(2) });
});
