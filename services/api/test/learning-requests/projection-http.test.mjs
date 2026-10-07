import assert from "node:assert/strict";
import { test } from "node:test";
import "reflect-metadata";
import {
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { GetLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/get-learning-request.use-case.js";
import { LearningRequestsController } from "../../dist/modules/learning-requests/presentation/http/learning-requests.controller.js";
import { LearningRequestQueryDto } from "../../dist/modules/learning-requests/presentation/http/learning-requests.dto.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const skillId = "44444444-4444-4444-8444-444444444444";
const tagId = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-10-07T00:00:00.000Z");

function record(overrides = {}) {
  return {
    id: requestId,
    ownerId: otherId,
    skillId,
    title: "Learn backend engineering",
    description: "Detailed description that must stay within its scope.",
    learningGoal: "Build production-ready APIs with guidance.",
    currentLevel: "BEGINNER",
    verifiedTeacherOnly: false,
    status: "OPEN",
    moderationStatus: "NOT_REQUIRED",
    moderationRejectReason: null,
    flaggedCategories: ["INTERNAL_ONLY"],
    moderationRuleSetVersion: 7,
    moderationReviewedVersion: null,
    moderatedByUserId: null,
    moderatedAt: null,
    requestedExpiresAt: null,
    expiresAt: new Date("2026-11-06T00:00:00.000Z"),
    expiryMode: "DEFAULT",
    publishedAt: now,
    version: 2,
    createdAt: now,
    updatedAt: now,
    preferredSlots: [],
    tagLinks: [{ requestId, tagId }],
    ...overrides,
  };
}

const user = {
  userId: ownerId,
  sessionId: "66666666-6666-4666-8666-666666666666",
  securityVersion: 1,
  roles: ["USER"],
  permissions: ["learning-request:read"],
};
const reviewer = {
  ...user,
  userId: otherId,
  roles: ["STAFF"],
  permissions: ["learning-request:moderation:read"],
};

function detailHarness(item, principal = user) {
  const calls = { permission: [], catalogs: [], owners: [] };
  const tx = { $queryRaw: async () => [] };
  const access = {
    assertAnyAction: async (_tx, actor, permissions) => {
      calls.permission.push(permissions);
      if (
        !permissions.some((permission) =>
          actor.permissions.includes(permission),
        )
      ) {
        throw Object.assign(new Error(), { status: 403 });
      }
      return actor;
    },
  };
  const repository = {
    databaseNow: async () => now,
    get: async (_tx, id) => (id === requestId ? item : null),
  };
  const catalog = {
    readSelections: async (_tx, selection) => {
      calls.catalogs.push(selection);
      return {
        skills: [{ id: skillId, name: "Backend engineering" }],
        tags: [{ id: tagId, label: "API design" }],
      };
    },
  };
  const owners = {
    readPublicOwners: async (_tx, ids) => {
      calls.owners.push(ids);
      return [{ id: otherId, displayName: "Learner" }];
    },
  };
  return {
    calls,
    useCase: new GetLearningRequestUseCase(
      { run: (work) => work(tx) },
      access,
      repository,
      catalog,
      owners,
    ),
    principal,
  };
}

test("detail projection selects owner, public, or moderation scope without leaking fields", async () => {
  const ownerRecord = record({
    ownerId,
    status: "REJECTED",
    moderationStatus: "REJECTED",
    moderationRejectReason: "Please clarify the goal",
  });
  const ownerFx = detailHarness(ownerRecord);
  const ownerDetail = await ownerFx.useCase.execute(user, requestId);
  assert.equal(ownerDetail.moderationRejectReason, "Please clarify the goal");
  assert.equal(ownerDetail.effectiveStatus, "REJECTED");
  assert.equal("flaggedCategories" in ownerDetail, false);
  assert.equal(ownerFx.calls.catalogs.length, 0);

  const publicFx = detailHarness(record());
  const publicDetail = await publicFx.useCase.execute(user, requestId);
  assert.equal(
    publicDetail.description,
    "Detailed description that must stay within its scope.",
  );
  assert.equal(publicDetail.owner.displayName, "Learner");
  assert.equal("ownerId" in publicDetail, false);
  assert.equal("flaggedCategories" in publicDetail, false);
  assert.equal("moderationRuleSetVersion" in publicDetail, false);

  const pendingFx = detailHarness(
    record({ status: "PENDING_MODERATION", moderationStatus: "PENDING" }),
    reviewer,
  );
  const reviewerDetail = await pendingFx.useCase.execute(reviewer, requestId);
  assert.deepEqual(reviewerDetail.flaggedCategories, ["INTERNAL_ONLY"]);
  assert.equal("moderationRuleSetVersion" in reviewerDetail, false);
  await assert.rejects(
    () =>
      detailHarness(
        record({ status: "PENDING_MODERATION", moderationStatus: "PENDING" }),
      ).useCase.execute(user, requestId),
    (error) => error.getStatus?.() === 404,
  );
});

test("private and expired records return 404 to outsiders; owners see effective expiry", async () => {
  const privateFx = detailHarness(record({ status: "DRAFT" }));
  await assert.rejects(
    () => privateFx.useCase.execute(user, requestId),
    (error) => error.getStatus?.() === 404,
  );
  const expired = record({ ownerId, expiresAt: now, status: "OPEN" });
  const expiredFx = detailHarness(expired);
  const own = await expiredFx.useCase.execute(user, requestId);
  assert.equal(own.status, "OPEN");
  assert.equal(own.effectiveStatus, "EXPIRED");
  await assert.rejects(
    () =>
      detailHarness(expired).useCase.execute(
        { ...user, userId: otherId },
        requestId,
      ),
    (error) => error.getStatus?.() === 404,
  );
});

test("detail requires an explicit current read permission before revealing resource scope", async () => {
  const denied = detailHarness(record(), { ...user, permissions: [] });
  await assert.rejects(
    () => denied.useCase.execute(denied.principal, requestId),
    (error) => error.status === 403,
  );
  assert.deepEqual(denied.calls.permission, [
    ["learning-request:read", "learning-request:moderation:read"],
  ]);
});

test("query routes validate scope, retain the standard envelope and reject guests", async () => {
  const calls = [];
  assert.equal(
    Reflect.getMetadata(
      PATH_METADATA,
      LearningRequestsController.prototype.mine,
    ),
    "mine",
  );
  assert.equal(
    Reflect.getMetadata(
      METHOD_METADATA,
      LearningRequestsController.prototype.mine,
    ),
    0,
  );
  assert.ok(
    Reflect.getMetadata(GUARDS_METADATA, LearningRequestsController).includes(
      IdentityGuard,
    ),
  );

  const guard = new IdentityGuard({ principal: async () => user });
  await assert.rejects(
    () =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      }),
    (error) => error instanceof UnauthorizedException,
  );

  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const query = await pipe.transform(
    { status: "DRAFT", limit: "5" },
    {
      type: "query",
      metatype: LearningRequestQueryDto,
    },
  );
  assert.deepEqual(query.tagIds, undefined);
  const tagQuery = await pipe.transform(
    { tagIds: tagId },
    {
      type: "query",
      metatype: LearningRequestQueryDto,
    },
  );
  assert.deepEqual(tagQuery.tagIds, [tagId]);
  await assert.rejects(
    () =>
      pipe.transform(
        { limit: "101" },
        { type: "query", metatype: LearningRequestQueryDto },
      ),
    (error) => error.getStatus?.() === 400,
  );
  const controller = new LearningRequestsController(
    {},
    {},
    {},
    {},
    {
      execute: async (actor, scope, input) => {
        calls.push({ actor, scope, input });
        return { items: [{ id: requestId }], nextCursor: null };
      },
    },
    { execute: async () => ({ id: requestId }) },
  );
  const envelope = await controller.mine(user, query);
  assert.deepEqual(calls[0], { actor: user, scope: "MINE", input: query });
  assert.deepEqual(envelope, {
    success: true,
    message: "Learning requests retrieved.",
    data: [{ id: requestId }],
    meta: { pagination: { nextCursor: null, hasMore: false, limit: 5 } },
  });
});

test("detail route documents every scoped response in OpenAPI", () => {
  const responses = Reflect.getMetadata(
    "swagger/apiResponse",
    LearningRequestsController.prototype.get,
  );
  assert.deepEqual(
    responses[200].schema.properties.data.oneOf.map((schema) => schema.$ref),
    [
      "#/components/schemas/LearningRequestDetailResponse",
      "#/components/schemas/LearningRequestOwnerResponse",
      "#/components/schemas/LearningRequestModerationResponse",
    ],
  );
});

test("OpenAPI includes the verified-teacher preference in create, edit and scoped responses", async () => {
  const dependencies = Reflect.getMetadata(
    "design:paramtypes",
    LearningRequestsController,
  );
  const module = await Test.createTestingModule({
    controllers: [LearningRequestsController],
    providers: dependencies.map((token) => ({ provide: token, useValue: {} })),
  })
    .overrideGuard(IdentityGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  try {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const schemas = document.components.schemas;
    for (const name of ["CreateLearningRequestDto", "EditLearningRequestDto"]) {
      assert.equal(
        schemas[name].properties.verifiedTeacherOnly?.type,
        "boolean",
      );
      assert.equal(
        schemas[name].required?.includes("verifiedTeacherOnly") ?? false,
        false,
      );
    }
    assert.equal(
      schemas.CreateLearningRequestDto.properties.verifiedTeacherOnly.default,
      false,
    );
    for (const name of [
      "LearningRequestOwnerResponse",
      "LearningRequestSummaryResponse",
      "LearningRequestModerationResponse",
    ]) {
      assert.equal(
        schemas[name].properties.verifiedTeacherOnly.type,
        "boolean",
      );
    }
  } finally {
    await app.close();
  }
});
