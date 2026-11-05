import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LearningPathsService } from "../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { ConversationMembershipReader } from "../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { Test } from "@nestjs/testing";
import { VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { LearningPathsController } from "../dist/modules/learning-paths/presentation/http/learning-paths.controller.js";
import { SessionsService } from "../dist/modules/auth/application/services/sessions.service.js";

const userA = "0a0a0a0a-0000-4000-8000-00000000000a";
const userB = "0b0b0b0b-0000-4000-8000-00000000000b";
const pathId = "9a9a9a9a-0000-4000-8000-000000000001";
const at = (iso) => new Date(iso);

function service(tx, conversations = { readTitles: async () => new Map() }) {
  return new LearningPathsService(
    { run: (work) => work(tx) },
    conversations,
    {},
    {},
  );
}

function pathRow(overrides = {}) {
  return {
    id: pathId,
    conversationId: "conversation",
    participantAId: userA,
    participantBId: userB,
    currentVersion: 2,
    lockedVersion: null,
    status: "CONFIRMED",
    createdAt: at("2026-10-01T00:00:00.000Z"),
    updatedAt: at("2026-10-02T00:00:00.000Z"),
    completedAt: null,
    settledAt: null,
    ...overrides,
  };
}

function planLink(planId, teacherId, learnerId) {
  return {
    planId,
    planVersion: 1,
    ownedPlanRecord: {
      id: planId,
      status: "CONFIRMED",
      teacherId,
      learnerId,
    },
    planVersionRecord: {
      skillId: `skill-${planId}`,
      learningGoal: `goal-${planId}`,
      totalSessions: 1,
      learnerConfirmedAt: at("2026-10-02T00:00:00.000Z"),
      planSessionOutlinePlanVersionRecords: [
        { sessionNo: 1, content: `outline-${planId}` },
      ],
    },
  };
}

function scheduleVersion(versionNo, currentVersion, planId, startAt) {
  return {
    scheduleProposalId: `schedule-${planId}`,
    versionNo,
    participantAConfirmedAt: at("2026-10-03T00:00:00.000Z"),
    participantBConfirmedAt: null,
    proposalRecord: {
      currentVersion,
      appliedVersion: null,
      status: "PARTIALLY_CONFIRMED",
    },
    scheduleItemScheduleVersionRecords: [
      {
        planId,
        planVersion: 1,
        sessionNo: 1,
        startAt: at(startAt),
        endAt: at("2026-10-10T11:00:00.000Z"),
      },
    ],
  };
}

function detailFixture(path, sessions = []) {
  const sessionQueries = [];
  const tx = {
    learningPath: { findUnique: () => path },
    learningPathVersion: {
      findUniqueOrThrow: () => ({
        versionNo: 2,
        exchangeType: "TWO_WAY",
        totalCreditPerUser: 2050n,
        negotiatedCredit: null,
        teacherId: null,
        learnerId: null,
        participantAConfirmedAt: at("2026-10-02T00:00:00.000Z"),
        participantBConfirmedAt: null,
      }),
    },
    pathVersionPlan: {
      findMany: () => [
        planLink("plan-ab", userA, userB),
        planLink("plan-ba", userB, userA),
      ],
    },
    scheduleVersion: {
      findMany: () => [
        scheduleVersion(1, 2, "plan-ab", "2026-10-09T10:00:00.000Z"),
        scheduleVersion(2, 2, "plan-ab", "2026-10-10T10:00:00.000Z"),
      ],
    },
    session: {
      findMany: (query) => {
        sessionQueries.push(query);
        return sessions;
      },
    },
  };
  return { tx, sessionQueries };
}

test("detail rejects missing paths and non-participants", async () => {
  const missing = detailFixture(null);
  await assert.rejects(
    service(missing.tx).detail({ userId: userA }, pathId),
    (error) =>
      error.getStatus() === 404 && error.message === "LEARNING_PATH_NOT_FOUND",
  );
  const other = detailFixture(pathRow());
  await assert.rejects(
    service(other.tx).detail(
      { userId: "0c0c0c0c-0000-4000-8000-00000000000c" },
      pathId,
    ),
    (error) =>
      error.getStatus() === 403 &&
      error.message === "LEARNING_PATH_ACCESS_DENIED",
  );
});

test("detail returns the agreement, plans and only the current schedule version", async () => {
  const fixture = detailFixture(pathRow());
  const result = await service(fixture.tx).detail({ userId: userB }, pathId);

  assert.deepEqual(result.agreement, {
    version: 2,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: "20.50",
    negotiatedCredit: null,
    teacherId: null,
    learnerId: null,
    participantAConfirmedAt: at("2026-10-02T00:00:00.000Z"),
    participantBConfirmedAt: null,
  });
  assert.deepEqual(
    result.plans.map(({ id, teacherId, sessionOutline }) => ({
      id,
      teacherId,
      sessionOutline,
    })),
    [
      {
        id: "plan-ab",
        teacherId: userA,
        sessionOutline: [{ sessionNo: 1, content: "outline-plan-ab" }],
      },
      {
        id: "plan-ba",
        teacherId: userB,
        sessionOutline: [{ sessionNo: 1, content: "outline-plan-ba" }],
      },
    ],
  );
  const [withSchedule, withoutSchedule] = result.plans;
  assert.equal(withSchedule.schedule.id, "schedule-plan-ab");
  assert.equal(withSchedule.schedule.version, 2);
  assert.deepEqual(withSchedule.schedule.items, [
    {
      sessionNo: 1,
      startAt: at("2026-10-10T10:00:00.000Z"),
      endAt: at("2026-10-10T11:00:00.000Z"),
    },
  ]);
  assert.equal(withoutSchedule.schedule, null);
  assert.deepEqual(withSchedule.sessions, []);
  assert.equal(fixture.sessionQueries.length, 0);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("detail groups sessions by plan once the path is locked", async () => {
  const session = (id, planId) => ({
    id,
    planId,
    outlineSessionNo: 1,
    startAt: at("2026-10-10T10:00:00.000Z"),
    endAt: at("2026-10-10T11:00:00.000Z"),
    status: "CONFIRMED",
  });
  const fixture = detailFixture(
    pathRow({ status: "SCHEDULED", lockedVersion: 2 }),
    [session("s-ab", "plan-ab"), session("s-ba", "plan-ba")],
  );
  const result = await service(fixture.tx).detail({ userId: userA }, pathId);

  assert.deepEqual(
    result.plans.map(({ sessions }) => sessions.map(({ id }) => id)),
    [["s-ab"], ["s-ba"]],
  );
  assert.equal(result.plans[0].sessions[0].sessionNo, 1);
});

test("listMine returns the counterpart and current exchange type", async () => {
  const versionQueries = [];
  const tx = {
    learningPath: {
      findMany: () => [pathRow(), pathRow({ id: "other", currentVersion: 1 })],
    },
    learningPathVersion: {
      findMany: (query) => {
        versionQueries.push(query);
        return [{ pathId, exchangeType: "ONE_WAY" }];
      },
    },
  };
  const result = await service(tx).listMine({ userId: userB });

  assert.deepEqual(versionQueries[0].where.OR, [
    { pathId, versionNo: 2 },
    { pathId: "other", versionNo: 1 },
  ]);
  assert.deepEqual(
    result.map(({ id, counterpartId, exchangeType }) => ({
      id,
      counterpartId,
      exchangeType,
    })),
    [
      { id: pathId, counterpartId: userA, exchangeType: "ONE_WAY" },
      { id: "other", counterpartId: userA, exchangeType: null },
    ],
  );

  const empty = await service({
    learningPath: { findMany: () => [] },
  }).listMine({ userId: userA });
  assert.deepEqual(empty, []);
});

test("mine adds the matching title per item in one page-level read without changing cursors", async () => {
  const rows = [
    pathRow(),
    pathRow({
      id: "9a9a9a9a-0000-4000-8000-000000000002",
      conversationId: "direct",
    }),
    pathRow({ id: "lookahead", conversationId: "outside-page" }),
  ];
  const calls = [];
  const tx = {
    learningPath: { findMany: async () => rows },
    learningPathVersion: { findMany: async () => [] },
  };
  const reader = {
    readTitles: async (context, viewer, ids) => {
      assert.equal(context, tx);
      calls.push({ viewer, ids });
      return new Map([
        ["conversation", "Học tiếng Anh"],
        ["direct", "TypeScript"],
      ]);
    },
  };
  const result = await service(tx, reader).listMinePage(
    { userId: userA },
    { limit: "2" },
  );
  assert.deepEqual(
    result.data.map(({ title }) => title),
    ["Học tiếng Anh", "TypeScript"],
  );
  assert.deepEqual(calls, [{ viewer: userA, ids: ["conversation", "direct"] }]);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(
    JSON.parse(
      Buffer.from(result.pagination.nextCursor, "base64url").toString(),
    ).id,
    rows[1].id,
  );
  const missing = await service(tx).listMinePage(
    { userId: userA },
    { limit: "1" },
  );
  assert.equal(missing.data[0].title, null);
});

test("conversation title projection restricts membership, prefers request title and falls back to direct skill name", async () => {
  const queries = [];
  const reader = new ConversationMembershipReader();
  const tx = {
    conversation: {
      findMany: async (query) => {
        queries.push(query);
        return [
          {
            id: "request-chat",
            requestIdRecord: { title: "Tiêu đề bài học đã đóng" },
            proposalIdRecord: { skillIdRecord: { name: "English" } },
          },
          {
            id: "direct-chat",
            requestIdRecord: null,
            proposalIdRecord: { skillIdRecord: { name: "TypeScript" } },
          },
        ];
      },
    },
  };
  const result = await reader.readTitles(tx, userB, [
    "request-chat",
    "direct-chat",
    "request-chat",
  ]);
  assert.equal(result.get("request-chat"), "Tiêu đề bài học đã đóng");
  assert.equal(result.get("direct-chat"), "TypeScript");
  assert.deepEqual(queries[0].where, {
    id: { in: ["request-chat", "direct-chat"] },
    OR: [{ participantAId: userB }, { participantBId: userB }],
  });
  assert.deepEqual(queries[0].select.requestIdRecord, {
    select: { title: true },
  });
  assert.equal(queries[0].select.requestIdRecord.select.content, undefined);
  assert.equal((await reader.readTitles(tx, userA, [])).size, 0);
  assert.equal(queries.length, 1);
});

test("GET learning-paths/mine includes title in the paginated JSON and Swagger schema", async () => {
  const paths = service(
    {
      learningPath: { findMany: async () => [pathRow()] },
      learningPathVersion: { findMany: async () => [] },
    },
    { readTitles: async () => new Map([["conversation", "Học TypeScript"]]) },
  );
  const module = await Test.createTestingModule({
    controllers: [LearningPathsController],
    providers: [
      { provide: LearningPathsService, useValue: paths },
      {
        provide: SessionsService,
        useValue: { principal: async () => ({ userId: userA }) },
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  await app.listen(0, "127.0.0.1");
  try {
    const base = await app.getUrl();
    assert.equal(
      (await fetch(`${base}/api/v1/learning-paths/mine`)).status,
      401,
    );
    const response = await fetch(`${base}/api/v1/learning-paths/mine?limit=2`, {
      headers: { authorization: "Bearer fixture" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data[0].title, "Học TypeScript");
    assert.equal(body.meta.pagination.limit, 2);
    assert.equal(body.meta.pagination.hasMore, false);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    assert.equal(
      doc.components.schemas.LearningPathSummaryResponse.properties.title
        .nullable,
      true,
    );
    assert.ok(doc.paths["/api/v1/learning-paths/mine"].get.responses[200]);
  } finally {
    await app.close();
  }
});
