import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import {
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { InboxGroupsService } from "../../dist/modules/conversations/application/services/inbox-groups.service.js";
import { ChatInboxRepository } from "../../dist/modules/conversations/infrastructure/persistence/chat-inbox.repository.js";
import { ConversationsController } from "../../dist/modules/conversations/presentation/http/conversations.controller.js";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import {
  inboxMessagePreview,
  newerInboxMessage,
} from "../../dist/modules/conversations/domain/inbox-message-summary.js";
import {
  inboxId,
  ownerId,
  senderId,
  thirdId,
} from "./inbox-groups.fixture.mjs";
import {
  fixture,
  conversation,
  group,
  message,
  summary,
  principal,
} from "./inbox-messages.fixture.mjs";

test("summary includes all 205 authorized chats in selected groups, not the child chat page", async () => {
  const rows = Array.from({ length: 205 }, (_, n) => conversation(n + 1));
  const tail = rows.at(-1);
  const direct = conversation(300, { requestId: null });
  const inaccessible = conversation(301, { participantAId: thirdId });
  const unrelated = conversation(302, { requestId: inboxId(6000) });
  const snapshots = new Map(rows.map((row) => [row.id, summary(row)]));
  snapshots.set(
    tail.id,
    summary(tail, { latestMessage: message(tail, 1000), hasUnread: true }),
  );
  snapshots.set(
    direct.id,
    summary(direct, { latestMessage: message(direct, 1001) }),
  );
  const f = fixture(
    [...rows, direct, inaccessible, unrelated],
    (ids, viewer) => {
      assert.equal(viewer, ownerId);
      return ids.map((id) => snapshots.get(id));
    },
  );
  const directGroup = {
    id: `conversation:${direct.id}`,
    learningRequestId: null,
    conversationId: direct.id,
  };
  const result = await f.reader.read(principal, [group, directGroup]);
  assert.equal(result.get(group.id).hasUnread, true);
  assert.equal(result.get(group.id).latestMessage.conversationId, tail.id);
  assert.equal(
    result.get(directGroup.id).latestMessage.conversationId,
    direct.id,
  );
  assert.equal(result.get(directGroup.id).hasUnread, false);
  assert.deepEqual(
    f.batches.map((batch) => batch.length),
    [100, 100, 6],
  );
  const fetched = f.batches.flat();
  assert.equal(fetched.length, 206);
  assert.equal(new Set(fetched).size, 206);
  assert(!fetched.includes(inaccessible.id));
  assert(!fetched.includes(unrelated.id));
});

test("latest message uses send time and ID between chats; any other chat can still be unread", async () => {
  const rows = [1, 2, 3].map((n) => conversation(n));
  const latest = {
    ...message(rows[1], 900, "2026-11-05T02:00:00.000Z"),
    senderId: ownerId,
  };
  const snapshots = [
    summary(rows[0], { latestMessage: message(rows[0], 999), hasUnread: true }),
    summary(rows[1], { latestMessage: latest }),
    summary(rows[2], {
      latestMessage: message(rows[2], 800, "2026-11-05T02:00:00.000Z"),
    }),
  ];
  const f = fixture(rows, () => snapshots);
  assert.deepEqual((await f.reader.read(principal, [group])).get(group.id), {
    latestMessage: latest,
    hasUnread: true,
  });
  assert.equal(newerInboxMessage(latest, null), latest);
  assert.equal(newerInboxMessage(latest, snapshots[0].latestMessage), latest);
});

test("proposal-only groups return null/false without querying Mongo; an empty Inbox does no hydration", async () => {
  const f = fixture([], () => assert.fail("No authorized conversations"));
  assert.deepEqual((await f.reader.read(principal, [group])).get(group.id), {
    latestMessage: null,
    hasUnread: false,
  });
  assert.equal(f.batches.length, 0);
  const before = f.queries.length;
  assert.equal((await f.reader.read(principal, [])).size, 0);
  assert.equal(f.queries.length, before);
});

test("viewer membership is enforced on both sides, including direct conversations", async () => {
  const rows = [
    conversation(1),
    conversation(2, { participantAId: thirdId }),
    conversation(3, { requestId: null, participantAId: thirdId }),
  ];
  const f = fixture(rows, (ids, viewer) => {
    assert.equal(viewer, senderId);
    return ids.map((id) => ({
      conversationId: id,
      latestMessage: null,
      hasUnread: false,
    }));
  });
  await f.reader.read({ userId: senderId }, [
    group,
    {
      id: `conversation:${rows[2].id}`,
      learningRequestId: null,
      conversationId: rows[2].id,
    },
  ]);
  assert.deepEqual(
    f.batches.flat(),
    rows.map((row) => row.id),
  );
});

test("lost grants before and during Mongo reads prevent private previews from returning", async () => {
  const row = conversation(1);
  const denied = fixture([row], () =>
    assert.fail("Query must be denied first"),
  );
  denied.deny("conversation:read:participant");
  await assert.rejects(denied.reader.read(principal, [group]), /grant revoked/);
  for (const permission of [
    "conversation:read:participant",
    "proposal:read:party",
  ]) {
    const f = fixture([row], () => {
      f.deny(permission);
      return [summary(row, { latestMessage: message(row, 1000) })];
    });
    await assert.rejects(f.reader.read(principal, [group]), /grant revoked/);
  }
});

test("Mongo failure or an incomplete batch is never reported as read/empty", async () => {
  const row = conversation(1);
  const failed = fixture([row], async () => {
    throw new Error("Mongo unavailable");
  });
  await assert.rejects(
    failed.reader.read(principal, [group]),
    /Mongo unavailable/,
  );
  const incomplete = fixture([row], async () => []);
  await assert.rejects(
    incomplete.reader.read(principal, [group]),
    /INBOX_MESSAGES_UNAVAILABLE/,
  );
});

test("preview normalizes plain text, bounds Unicode characters and handles file/system messages", () => {
  assert.equal(
    inboxMessagePreview(" \n Hello\t world \r\n", "TEXT"),
    "Hello world",
  );
  assert.equal(inboxMessagePreview("", "FILE"), "Đã gửi một tệp");
  assert.equal(inboxMessagePreview(" ", "SYSTEM"), "Cập nhật cuộc trò chuyện");
  assert.equal(inboxMessagePreview("a".repeat(200), "TEXT").length, 160);
  assert.equal([...inboxMessagePreview("🌿".repeat(200), "TEXT")].length, 160);
});

test("chat repository exposes only the bounded public projection and converts incomplete/unavailable batches to 503", async () => {
  const row = conversation(1);
  let result = [
    {
      _id: row.id,
      latest: {
        _id: inboxId(1000),
        conversationId: row.id,
        senderId,
        messageType: "FILE",
        messageText: "",
        sentAt: new Date(),
        storageKey: "private",
      },
      hasUnread: true,
    },
  ];
  let pipeline;
  const repo = new ChatInboxRepository(
    {
      db: {
        aggregate: (stages, options) => {
          pipeline = stages;
          assert.equal(options.maxTimeMS, 5000);
          assert.equal(options.readConcern.level, "snapshot");
          return { toArray: async () => result };
        },
      },
    },
    { ready: async () => {} },
  );
  const first = (await repo.read([row.id], ownerId))[0];
  assert.equal(first.latestMessage.preview, "Đã gửi một tệp");
  assert(!JSON.stringify(first).includes("private"));
  assert(!JSON.stringify(first).includes("messageText"));
  assert.deepEqual(pipeline[0], { $documents: [{ _id: row.id }] });
  const before = pipeline;
  assert.deepEqual(await repo.read([], ownerId), []);
  assert.equal(pipeline, before);
  result = [];
  await assert.rejects(
    repo.read([row.id], ownerId),
    (error) => error.getStatus() === 503,
  );
  result = [{ _id: row.id, latest: { sentAt: "invalid" }, hasUnread: false }];
  await assert.rejects(
    repo.read([row.id], ownerId),
    /INBOX_MESSAGES_UNAVAILABLE/,
  );
  const unavailable = new ChatInboxRepository(
    {
      db: {
        aggregate: () => {
          throw new Error("network");
        },
      },
    },
    { ready: async () => {} },
  );
  await assert.rejects(
    unavailable.read([row.id], ownerId),
    /INBOX_MESSAGES_UNAVAILABLE/,
  );
});

test("HTTP Inbox enriches only selected groups, keeps pagination and reports summary failure", async () => {
  const row = conversation(1);
  const latest = message(row, 1000);
  const f = fixture([row], () => [
    summary(row, { latestMessage: latest, hasUnread: true }),
  ]);
  const source = {
    key: group.id,
    groupType: "LEARNING_REQUEST",
    learningRequestId: group.learningRequestId,
    conversationId: null,
    sourceProposalId: null,
    receivedProposalCount: 3,
    sentProposalCount: 0,
    conversationCount: 1,
    lastActivityAt: latest.sentAt,
  };
  let fail = false;
  const service = new InboxGroupsService(
    f.transactions,
    f.actors,
    {
      page: async () => [
        source,
        { ...source, key: `request:${inboxId(6000)}` },
      ],
    },
    { groupedProjection: () => null },
    {
      read: async (_tx, viewer, ids) => {
        assert.equal(viewer, ownerId);
        assert.deepEqual(ids, [group.learningRequestId]);
        return new Map([
          [group.learningRequestId, { title: "Request", ownerId }],
        ]);
      },
    },
    { read: async () => new Map() },
    {
      read: (...args) => {
        if (fail)
          throw new ServiceUnavailableException("INBOX_MESSAGES_UNAVAILABLE");
        return f.reader.read(...args);
      },
    },
  );
  const module = await Test.createTestingModule({
    controllers: [ConversationsController],
    providers: [
      { provide: ConversationsService, useValue: {} },
      { provide: InboxGroupsService, useValue: service },
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
    const url = `${await app.getUrl()}/api/v1/conversations/inbox?limit=1`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].hasUnread, true);
    assert.equal(body.data[0].latestMessage.conversationId, row.id);
    assert.equal(
      body.data[0].latestMessage.sentAt,
      latest.sentAt.toISOString(),
    );
    assert.equal(body.meta.pagination.hasMore, true);
    assert(body.meta.pagination.nextCursor);
    fail = true;
    assert.equal((await fetch(url)).status, 503);
  } finally {
    await app.close();
  }
});
