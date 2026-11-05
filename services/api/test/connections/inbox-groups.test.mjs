import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { VersioningType, ValidationPipe } from "@nestjs/common";
import { ConversationsController } from "../../dist/modules/conversations/presentation/http/conversations.controller.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { InboxGroupsService } from "../../dist/modules/conversations/application/services/inbox-groups.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { LearningRequestInboxReader } from "../../dist/modules/learning-requests/application/services/learning-request-inbox.reader.js";
import {
  inboxId,
  ownerId,
  senderId,
  thirdId,
} from "./inbox-groups.fixture.mjs";
import {
  writeInboxGroupCursor,
  readInboxGroupCursor,
} from "../../dist/modules/conversations/domain/inbox-group-cursor.js";

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((term) => matches(row, term));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("some" in value)
        return row[key].some((item) => matches(item, value.some));
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}

test("historical title access includes closed/hidden owner, proposer and chat parties only", async () => {
  const rows = [
    { id: inboxId(1), ownerId: senderId, status: "CLOSED" },
    {
      id: inboxId(2),
      ownerId,
      status: "CANCELLED",
      proposalRequestIdRecords: [{ proposerId: senderId }],
    },
    {
      id: inboxId(3),
      ownerId,
      status: "EXPIRED",
      conversationRequestIdRecords: [
        { participantAId: thirdId, participantBId: senderId },
      ],
    },
    { id: inboxId(4), ownerId, status: "CLOSED" },
    { id: inboxId(5), ownerId, status: "OPEN" },
  ].map((row) => ({
    title: "Historical title",
    description: "must not leak",
    proposalRequestIdRecords: [],
    conversationRequestIdRecords: [],
    ...row,
  }));
  const tx = {
    learningRequest: {
      findMany: async ({ where, select }) => {
        assert.deepEqual(Object.keys(select).sort(), [
          "id",
          "ownerId",
          "title",
        ]);
        return rows.filter((row) => matches(row, where));
      },
    },
  };
  const result = await new LearningRequestInboxReader().read(
    tx,
    senderId,
    rows.map((row) => row.id),
  );
  assert.deepEqual([...result.keys()], [1, 2, 3].map(inboxId));
  assert.equal(result.get(inboxId(2)).title, "Historical title");
  assert(!JSON.stringify([...result.values()]).includes("must not leak"));
  assert.equal(
    (
      await new LearningRequestInboxReader().read(
        tx,
        inboxId(199),
        rows.map((row) => row.id),
      )
    ).size,
    0,
  );
});

test("group cursor validates ordering/viewer, timestamp and stable namespaced identity", () => {
  const date = new Date("2026-11-03T00:00:00.000Z");
  const cursor = writeInboxGroupCursor(
    "viewer-a",
    `request:${inboxId(1)}`,
    date,
  );
  assert.deepEqual(readInboxGroupCursor(cursor, "viewer-a"), {
    key: `request:${inboxId(1)}`,
    at: date,
  });
  assert.throws(
    () => readInboxGroupCursor(cursor, "viewer-b"),
    /INVALID_CURSOR/,
  );
  for (const payload of [
    { scope: "viewer-a", at: "not-a-date", key: `request:${inboxId(1)}` },
    {
      scope: "viewer-a",
      at: "0000-01-01T00:00:00.000Z",
      key: `request:${inboxId(1)}`,
    },
    { scope: "viewer-a", at: date.toISOString(), key: "request:injection" },
    { scope: "viewer-a", value: inboxId(1), id: inboxId(1) },
  ])
    assert.throws(
      () =>
        readInboxGroupCursor(
          Buffer.from(JSON.stringify(payload)).toString("base64url"),
          "viewer-a",
        ),
      /INVALID_CURSOR/,
    );
});

test("Inbox rejects lost proposal/chat grants before aggregating private counts", async () => {
  for (const blocked of [
    "proposal:read:party",
    "conversation:read:participant",
  ]) {
    let queried = false;
    const service = new InboxGroupsService(
      { run: (work) => work({}) },
      {
        require: async (_tx, _principal, permission) => {
          if (permission === blocked) throw new Error("grant revoked");
        },
      },
      {
        page: async () => {
          queried = true;
          return [];
        },
      },
      {},
      {},
      {},
    );
    await assert.rejects(
      service.list({ userId: ownerId }, {}),
      /grant revoked/,
    );
    assert.equal(queried, false);
  }
});

test("HTTP Inbox route precedes UUID detail, retains pagination and accepts the child Request filter", async () => {
  let lastQuery;
  const expected = {
    id: `request:${inboxId(1)}`,
    title: "Closed Request",
    viewerRole: "OWNER",
    receivedProposalCount: 25,
    sentProposalCount: 0,
    conversationCount: 4,
    latestMessage: null,
    hasUnread: false,
  };
  const paging = { limit: 1, hasMore: true, nextCursor: "opaque" };
  const module = await Test.createTestingModule({
    controllers: [ConversationsController],
    providers: [
      {
        provide: ConversationsService,
        useValue: {
          list: async (_actor, query) => {
            lastQuery = query;
            return { data: [], pagination: paging };
          },
          get: async (_actor, id) => ({ id }),
        },
      },
      {
        provide: InboxGroupsService,
        useValue: {
          list: async () => ({ data: [expected], pagination: paging }),
        },
      },
    ],
  })
    .overrideGuard(IdentityGuard)
    .useValue({
      canActivate: (context) => {
        context.switchToHttp().getRequest().principal = { userId: ownerId };
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
    const base = await app.getUrl();
    const response = await fetch(`${base}/api/v1/conversations/inbox?limit=1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, [expected]);
    assert.deepEqual(body.meta.pagination, paging);
    assert.equal(
      (await fetch(`${base}/api/v1/conversations/inbox?limit=101`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/v1/conversations/inbox?viewerId=${senderId}`))
        .status,
      400,
    );
    assert.equal(
      (
        await fetch(
          `${base}/api/v1/conversations?learningRequestId=${inboxId(1)}`,
        )
      ).status,
      200,
    );
    assert.equal(lastQuery.learningRequestId, inboxId(1));
    const detail = await fetch(`${base}/api/v1/conversations/${inboxId(10)}`);
    assert.equal(detail.status, 200);
  } finally {
    await app.close();
  }
});
