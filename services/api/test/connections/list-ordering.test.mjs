import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { ProposalsService } from "../../dist/modules/proposals/application/services/proposals.service.js";
import { ProposalQueryDto } from "../../dist/modules/proposals/presentation/http/proposals.dto.js";
import { ProposalsController } from "../../dist/modules/proposals/presentation/http/proposals.controller.js";
import { ConversationsController } from "../../dist/modules/conversations/presentation/http/conversations.controller.js";
import { InboxGroupsService } from "../../dist/modules/conversations/application/services/inbox-groups.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { readTimeIdCursor } from "../../dist/shared/http/time-id-cursor.js";
import { cursorScope } from "../../dist/modules/skills/domain/skill-policy.js";
import {
  inboxId,
  ownerId,
  senderId,
  thirdId,
} from "./inbox-groups.fixture.mjs";

const at = (day) =>
  new Date(`2026-11-${String(day).padStart(2, "0")}T00:00:00.000Z`);
const principal = { userId: senderId };
const requestId = inboxId(100);
const encode = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

// Evaluate the Prisma predicates/order before take, including nested AND/OR.
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((term) => matches(row, term));
    if (key === "AND") return value.every((term) => matches(row, term));
    if (value instanceof Date) return +row[key] === +value;
    if (value && typeof value === "object") {
      if ("lt" in value) return row[key] < value.lt;
      if ("gt" in value) return row[key] > value.gt;
      assert.fail(`Unsupported predicate: ${key}`);
    }
    return row[key] === value;
  });
}

function fixture(kind, rows) {
  let revoked = false;
  const calls = [];
  const tx = {
    [kind]: {
      findMany: async (args) => {
        calls.push(args);
        const orders = Array.isArray(args.orderBy)
          ? args.orderBy
          : [args.orderBy];
        return rows
          .filter((row) => matches(row, args.where))
          .sort((a, b) => {
            for (const order of orders) {
              const [key, direction] = Object.entries(order)[0];
              if (a[key] < b[key]) return direction === "desc" ? 1 : -1;
              if (a[key] > b[key]) return direction === "desc" ? -1 : 1;
            }
            return 0;
          })
          .slice(0, args.take);
      },
    },
  };
  const transactions = { run: (work) => work(tx) };
  const actors = {
    require: async () => {
      if (revoked) throw new Error("grant revoked");
    },
  };
  const requests = {
    proposalSource: async () => ({ ownerId }),
    inboxMetadata: async () => new Map(),
  };
  const service =
    kind === "conversation"
      ? new ConversationsService(tx, transactions, {}, actors)
      : new ProposalsService(tx, transactions, {}, actors, {}, requests);
  return {
    service,
    calls,
    revoke: () => {
      revoked = true;
    },
  };
}

const chatRows = () =>
  [
    [1, 4],
    [4, 3],
    [2, 3],
    [8, 1],
  ].map(([id, day]) => ({
    id: inboxId(id),
    requestId,
    proposalId: inboxId(id + 20),
    participantAId: senderId,
    participantBId: ownerId,
    createdAt: at(1),
    lastActivityAt: at(day),
  }));

test("chat orders by activity before pagination, breaks timestamp ties by descending ID and retains filters", async () => {
  const rows = chatRows();
  rows.push(
    {
      ...rows[0],
      id: inboxId(5),
      requestId: inboxId(101),
      lastActivityAt: at(6),
    },
    {
      ...rows[0],
      id: inboxId(6),
      participantAId: thirdId,
      lastActivityAt: at(7),
    },
  );
  const { service } = fixture("conversation", rows);
  const query = { learningRequestId: requestId, limit: 2 };
  const first = await service.list(principal, query);
  assert.deepEqual(
    first.data.map((row) => row.id),
    [1, 4].map(inboxId),
  );
  assert.equal(+first.data[0].lastActivityAt, +at(4));
  const second = await service.list(principal, {
    ...query,
    cursor: first.pagination.nextCursor,
  });
  assert.deepEqual(
    second.data.map((row) => row.id),
    [2, 8].map(inboxId),
  );
  assert.equal(second.pagination.hasMore, false);
  assert.equal(second.pagination.nextCursor, null);
  assert.deepEqual(
    (await service.list(principal, { limit: 100 })).data.map((row) => row.id),
    [5, 1, 4, 2, 8].map(inboxId),
  );
  for (const changed of [
    { learningRequestId: inboxId(101) },
    { learningRequestId: undefined },
  ])
    await assert.rejects(
      service.list(principal, {
        ...query,
        ...changed,
        cursor: first.pagination.nextCursor,
      }),
      /INVALID_CURSOR/,
    );
  await assert.rejects(
    service.list(
      { userId: thirdId },
      { ...query, cursor: first.pagination.nextCursor },
    ),
    /INVALID_CURSOR/,
  );
});

test("chat cursor keeps the original activity boundary when rows move; refresh sees new activity", async () => {
  const rows = chatRows();
  const { service } = fixture("conversation", rows);
  const first = await service.list(principal, { limit: 2 });
  rows[1].lastActivityAt = at(8); // cursor row moves after it was returned
  rows[3].lastActivityAt = at(9); // unseen row moves above the previous boundary
  const second = await service.list(principal, {
    limit: 2,
    cursor: first.pagination.nextCursor,
  });
  assert.deepEqual(
    second.data.map((row) => row.id),
    [inboxId(2)],
  );
  assert.deepEqual(
    (await service.list(principal, { limit: 2 })).data.map((row) => row.id),
    [8, 4].map(inboxId),
  );
});

const proposalRows = () =>
  [
    [1, 5, true],
    [8, 4, false],
    [3, 4, true],
    [7, 2, false],
  ].map(([id, day, sent]) => ({
    id: inboxId(id),
    requestId,
    proposedCredit: null,
    status: "PENDING",
    proposerId: sent ? senderId : ownerId,
    recipientId: sent ? ownerId : senderId,
    createdAt: at(day),
  }));

test("proposal all merges unequal sent/received streams before pagination; each direction and default stay scoped", async () => {
  const rows = proposalRows();
  rows.push(
    {
      ...rows[0],
      id: inboxId(6),
      proposerId: thirdId,
      recipientId: ownerId,
      createdAt: at(9),
    },
    { ...rows[0], id: inboxId(9), status: "WITHDRAWN", createdAt: at(8) },
    { ...rows[0], id: inboxId(10), requestId: inboxId(101), createdAt: at(7) },
  );
  const { service } = fixture("proposal", rows);
  const query = { direction: "all", status: "PENDING", limit: 2 };
  const first = await service.list(principal, query);
  assert.deepEqual(
    first.data.map((row) => row.id),
    [10, 1].map(inboxId),
  );
  const second = await service.list(principal, {
    ...query,
    cursor: first.pagination.nextCursor,
  });
  assert.deepEqual(
    second.data.map((row) => row.id),
    [8, 3].map(inboxId),
  );
  const third = await service.list(principal, {
    ...query,
    cursor: second.pagination.nextCursor,
  });
  assert.deepEqual(
    third.data.map((row) => row.id),
    [inboxId(7)],
  );
  assert.equal(third.pagination.nextCursor, null);
  const received = await service.list(principal, { limit: 100 });
  assert.deepEqual(
    received.data.map((row) => row.id),
    [8, 7].map(inboxId),
  );
  const sent = await service.list(principal, {
    direction: "sent",
    learningRequestId: requestId,
    limit: 100,
  });
  assert.deepEqual(
    sent.data.map((row) => row.id),
    [9, 1, 3].map(inboxId),
  );
  for (const changed of [
    { direction: "received" },
    { status: "WITHDRAWN" },
    { learningRequestId: requestId },
  ])
    await assert.rejects(
      service.list(principal, {
        ...query,
        ...changed,
        cursor: first.pagination.nextCursor,
      }),
      /INVALID_CURSOR/,
    );
  await assert.rejects(
    service.list(
      { userId: thirdId },
      { ...query, cursor: first.pagination.nextCursor },
    ),
    /INVALID_CURSOR/,
  );
});

test("received/all Request filters remain owner-only while sent history is available to the sender", async () => {
  const { service } = fixture("proposal", proposalRows());
  for (const direction of [undefined, "received", "all"])
    await assert.rejects(
      service.list(principal, { direction, learningRequestId: requestId }),
      (error) => error.getStatus() === 404,
    );
  const owned = await service.list(
    { userId: ownerId },
    { direction: "all", learningRequestId: requestId },
  );
  assert.deepEqual(
    owned.data.map((row) => row.id),
    [1, 8, 3, 7].map(inboxId),
  );
});

test("both lists reject revoked grants before querying rows", async () => {
  for (const kind of ["conversation", "proposal"]) {
    const f = fixture(kind, []);
    f.revoke();
    await assert.rejects(f.service.list(principal, {}), /grant revoked/);
    assert.equal(f.calls.length, 0);
  }
});

test("time/ID cursors reject malformed values, foreign ordering and legacy ID-only cursors", async () => {
  assert.equal(readTimeIdCursor(undefined, "scope"), undefined);
  assert.deepEqual(
    readTimeIdCursor(
      encode({ scope: "scope", id: inboxId(1), value: at(1).toISOString() }),
      "scope",
    ),
    { id: inboxId(1), at: at(1) },
  );
  for (const payload of [
    { scope: "other", id: inboxId(1), value: at(1).toISOString() },
    { scope: "scope", id: "invalid", value: at(1).toISOString() },
    { scope: "scope", id: inboxId(1), value: "2026-02-30T00:00:00.000Z" },
    { scope: "scope", id: inboxId(1), value: "0000-01-01T00:00:00.000Z" },
    { scope: "scope", id: inboxId(1), value: "2026-11-01T00:00:00Z" },
    { scope: "scope", id: inboxId(1), value: inboxId(1) },
  ])
    assert.throws(
      () => readTimeIdCursor(encode(payload), "scope"),
      /INVALID_CURSOR/,
    );
  for (const value of ["not-json", "x".repeat(1025)])
    assert.throws(() => readTimeIdCursor(value, "scope"), /INVALID_CURSOR/);
  const legacy = cursorScope({ type: "conversations", viewer: senderId });
  await assert.rejects(
    fixture("conversation", []).service.list(principal, {
      cursor: encode({
        scope: legacy,
        id: inboxId(1),
        value: at(1).toISOString(),
      }),
    }),
    /INVALID_CURSOR/,
  );
  const chat = await fixture("conversation", chatRows()).service.list(
    principal,
    { limit: 1 },
  );
  await assert.rejects(
    fixture("proposal", []).service.list(principal, {
      cursor: chat.pagination.nextCursor,
    }),
    /INVALID_CURSOR/,
  );
});

test("proposal query DTO accepts all and keeps direction/status/limit validation", async () => {
  assert.deepEqual(
    await validate(
      plainToInstance(ProposalQueryDto, {
        direction: "all",
        limit: "2",
        status: "PENDING",
      }),
    ),
    [],
  );
  for (const query of [
    { direction: "other" },
    { status: "other" },
    { limit: "101" },
  ])
    assert(
      (await validate(plainToInstance(ProposalQueryDto, query))).length > 0,
    );
});

test("HTTP lists preserve timestamp cursors, combined direction, activity metadata and access errors", async () => {
  const module = await Test.createTestingModule({
    controllers: [ProposalsController, ConversationsController],
    providers: [
      {
        provide: ProposalsService,
        useValue: fixture("proposal", proposalRows()).service,
      },
      {
        provide: ConversationsService,
        useValue: fixture("conversation", chatRows()).service,
      },
      { provide: InboxGroupsService, useValue: {} },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (context) => {
        context.switchToHttp().getRequest().principal = principal;
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  try {
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1`;
    const read = (path) => fetch(`${base}/${path}`);
    const first = await read("proposals?direction=all&status=PENDING&limit=2");
    assert.equal(first.status, 200);
    const body = await first.json();
    assert.deepEqual(
      body.data.map((row) => row.id),
      [1, 8].map(inboxId),
    );
    const cursor = encodeURIComponent(body.meta.pagination.nextCursor);
    const second = await read(
      `proposals?direction=all&status=PENDING&limit=2&cursor=${cursor}`,
    );
    const next = await second.json();
    assert.equal(second.status, 200);
    assert.deepEqual(
      next.data.map((row) => row.id),
      [3, 7].map(inboxId),
    );
    assert.equal(next.meta.pagination.hasMore, false);
    assert.equal(
      (await read(`proposals?direction=sent&status=PENDING&cursor=${cursor}`))
        .status,
      400,
    );
    assert.equal(
      (await read(`proposals?direction=all&learningRequestId=${requestId}`))
        .status,
      404,
    );
    assert.equal(
      (await read("proposals?direction=all&viewerId=someone-else")).status,
      400,
    );
    const chats = await read(
      `conversations?learningRequestId=${requestId}&limit=2`,
    );
    assert.equal(chats.status, 200);
    const chatBody = await chats.json();
    assert.deepEqual(
      chatBody.data.map((row) => row.id),
      [1, 4].map(inboxId),
    );
    assert.equal(chatBody.data[0].lastActivityAt, at(4).toISOString());
    const chatNext = await read(
      `conversations?learningRequestId=${requestId}&limit=2&cursor=${encodeURIComponent(chatBody.meta.pagination.nextCursor)}`,
    );
    assert.deepEqual(
      (await chatNext.json()).data.map((row) => row.id),
      [2, 8].map(inboxId),
    );
  } finally {
    await app.close();
  }
});
