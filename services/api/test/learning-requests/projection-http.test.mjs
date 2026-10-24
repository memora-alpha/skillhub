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
import { RequestModerationController } from "../../dist/modules/learning-requests/presentation/http/request-moderation.controller.js";
import { LearningRequestModerationRulesController } from "../../dist/modules/system-configuration/presentation/http/learning-request-moderation-rules.controller.js";
import { NotificationsController } from "../../dist/modules/notifications/presentation/http/notifications.controller.js";
import {
  CreateLearningRequestDto,
  EditLearningRequestDto,
  LearningRequestQueryDto,
  PreferredSlotDto,
} from "../../dist/modules/learning-requests/presentation/http/learning-requests.dto.js";

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

test("create and edit retain optional slots, nested validation and nullable expiry", async () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const slot = {
    startAt: "2026-12-01T10:00:00Z",
    endAt: "2026-12-01T11:00:00Z",
  };
  for (const [metatype, body] of [
    [
      CreateLearningRequestDto,
      {
        title: "Learn backend",
        skillId,
        description: "A detailed learning request",
        learningGoal: "Build a working API",
      },
    ],
    [EditLearningRequestDto, { expectedVersion: 1 }],
  ]) {
    const transform = (fields) =>
      pipe.transform({ ...body, ...fields }, { type: "body", metatype });
    const omitted = await transform({});
    assert.equal(omitted.preferredSlots, undefined);
    assert.equal(omitted.expiresAt, undefined);
    const valid = await transform({ preferredSlots: [slot], expiresAt: null });
    assert.ok(valid.preferredSlots[0] instanceof PreferredSlotDto);
    assert.equal(valid.expiresAt, null);
    for (const fields of [
      { preferredSlots: null },
      { preferredSlots: Array(6).fill(slot) },
      { preferredSlots: [{ ...slot, startAt: "invalid" }] },
      { expiresAt: "invalid" },
    ]) {
      await assert.rejects(
        () => transform(fields),
        (error) => error.getStatus?.() === 400,
      );
    }
  }
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

test("OpenAPI documents complete Learning Request inputs and scoped responses", async () => {
  const controllers = [
    LearningRequestsController,
    RequestModerationController,
    LearningRequestModerationRulesController,
    NotificationsController,
  ];
  const dependencies = new Set(
    controllers.flatMap((controller) =>
      Reflect.getMetadata("design:paramtypes", controller),
    ),
  );
  const module = await Test.createTestingModule({
    controllers,
    providers: [...dependencies].map((token) => ({
      provide: token,
      useValue: {},
    })),
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
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schemas = document.components.schemas;
    for (const [name, fields] of [
      [
        "LearningRequestOwnerResponse",
        {
          currentLevel: "string",
          moderationRejectReason: "string",
          requestedExpiresAt: "string",
          expiresAt: "string",
          publishedAt: "string",
        },
      ],
      [
        "LearningRequestSummaryResponse",
        { currentLevel: "string", expiresAt: "string" },
      ],
      [
        "LearningRequestModerationResponse",
        {
          currentLevel: "string",
          moderationRejectReason: "string",
          moderationReviewedVersion: "integer",
          moderatedByUserId: "string",
          moderatedAt: "string",
          expiresAt: "string",
        },
      ],
      ["NotificationResponse", { readAt: "string" }],
    ]) {
      for (const [field, type] of Object.entries(fields)) {
        assert.equal(
          schemas[name].properties[field].type,
          type,
          `${name}.${field} type`,
        );
        assert.equal(
          schemas[name].properties[field].nullable,
          true,
          `${name}.${field} nullable`,
        );
        assert.ok(
          schemas[name].required.includes(field),
          `${name}.${field} is always present`,
        );
      }
    }
    for (const name of [
      "ApproveLearningRequestDto",
      "RejectLearningRequestDto",
    ]) {
      assert.deepEqual(
        new Set(schemas[name].required),
        new Set(["expectedVersion", "reason"]),
      );
      assert.equal(schemas[name].properties.expectedVersion.type, "integer");
    }
    assert.equal(
      schemas.ApproveLearningRequestDto.properties.reason.maxLength,
      2000,
    );
    assert.equal(
      schemas.RejectLearningRequestDto.properties.reason.minLength,
      10,
    );
    assert.equal(
      schemas.RejectLearningRequestDto.properties.reason.maxLength,
      500,
    );
    const rules = schemas.UpdateLearningRequestModerationRulesDto;
    assert.deepEqual(
      new Set(rules.required),
      new Set(["expectedVersion", "rules", "reason"]),
    );
    assert.equal(rules.properties.rules.minItems, 1);
    assert.equal(rules.properties.rules.maxItems, 250);
    assert.equal(
      rules.properties.rules.items.$ref,
      "#/components/schemas/ModerationRuleDto",
    );
    assert.deepEqual(schemas.ModerationRuleDto.required, [
      "category",
      "pattern",
    ]);
    assert.equal(
      schemas.ModerationRuleDto.properties.category.pattern,
      "^[A-Za-z][A-Za-z0-9_-]*$",
    );
    const inbox = document.paths["/api/v1/notifications"];
    assert.deepEqual(
      new Set(inbox.get.parameters.map(({ name }) => name)),
      new Set(["limit", "cursor"]),
    );
    assert.equal(
      inbox.get.parameters.find(({ name }) => name === "limit").schema.default,
      20,
    );
    const markRead =
      document.paths["/api/v1/notifications/{notificationId}/read"].patch;
    assert.ok(markRead.responses[204]);
    assert.equal(markRead.parameters[0].schema.format, "uuid");
    for (const suffix of ["approve", "reject"]) {
      const operation =
        document.paths[`/api/v1/staff/learning-requests/{requestId}/${suffix}`]
          .post;
      assert.ok(
        operation.responses[200].content["application/json"].schema.properties
          .data.$ref,
      );
      assert.equal(operation.parameters[0].schema.format, "uuid");
      assert.deepEqual(operation.security, [{ bearer: [] }]);
    }
    let operationCount = 0;
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        operationCount += 1;
        assert.deepEqual(
          operation.security,
          [{ bearer: [] }],
          `${method} ${path} authentication`,
        );
        let successStatus = 200;
        if (path.endsWith("/read")) successStatus = 204;
        else if (method === "post" && path === "/api/v1/learning-requests")
          successStatus = 201;
        assert.ok(
          operation.responses[successStatus],
          `${method} ${path} success response`,
        );
        if (successStatus !== 204) {
          assert.ok(
            operation.responses[successStatus].content["application/json"]
              .schema.properties.data,
            `${method} ${path} response envelope`,
          );
        }
        for (const parameter of operation.parameters ?? []) {
          if (parameter.in !== "path") continue;
          assert.equal(parameter.required, true);
          assert.equal(
            parameter.schema.format,
            "uuid",
            `${method} ${path} ${parameter.name}`,
          );
        }
      }
    }
    assert.equal(operationCount, 15);
    const contentFields = [
      "teachingOverview",
      "offeredSharingSkillIds",
      "desiredCreditPerHour",
      "preferredAvailability",
      "title",
      "skillId",
      "description",
      "learningGoal",
      "currentLevel",
      "verifiedTeacherOnly",
      "tagIds",
      "proposedTags",
      "preferredSlots",
      "expiresAt",
    ];
    assert.deepEqual(
      new Set(Object.keys(schemas.CreateLearningRequestDto.properties)),
      new Set(contentFields),
    );
    assert.deepEqual(
      new Set(schemas.CreateLearningRequestDto.required),
      new Set(["title", "skillId", "description", "learningGoal"]),
    );
    assert.deepEqual(
      new Set(Object.keys(schemas.EditLearningRequestDto.properties)),
      new Set(["expectedVersion", ...contentFields]),
    );
    assert.deepEqual(schemas.EditLearningRequestDto.required, [
      "expectedVersion",
    ]);
    for (const name of [
      "PublishLearningRequestDto",
      "CancelLearningRequestDto",
    ]) {
      assert.deepEqual(schemas[name].required, ["expectedVersion"]);
      assert.equal(schemas[name].properties.expectedVersion.minimum, 1);
    }
    const create = schemas.CreateLearningRequestDto.properties;
    assert.equal(create.skillId.format, "uuid");
    assert.equal(create.tagIds.items.format, "uuid");
    assert.equal(create.tagIds.maxItems, 10);
    assert.equal(create.proposedTags.maxItems, 10);
    assert.equal(create.proposedTags.items.type, "string");
    assert.equal(create.preferredSlots.maxItems, 5);
    assert.equal(create.offeredSharingSkillIds.maxItems, 10);
    assert.equal(create.offeredSharingSkillIds.items.format, "uuid");
    assert.equal(create.teachingOverview.nullable, true);
    assert.equal(create.desiredCreditPerHour.type, "string");
    assert.equal(create.desiredCreditPerHour.nullable, true);
    assert.deepEqual(
      new Set(schemas.PreferredAvailabilityDto.required),
      new Set(["timeZone", "weeklySlots"]),
    );
    assert.equal(
      schemas.PreferredAvailabilityDto.properties.weeklySlots.maxItems,
      5,
    );
    assert.deepEqual(schemas.WeeklySlotDto.properties.weekday.enum, [
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
    assert.equal(
      create.preferredSlots.items.$ref,
      "#/components/schemas/PreferredSlotDto",
    );
    assert.deepEqual(schemas.PreferredSlotDto.required, ["startAt", "endAt"]);
    assert.equal(
      schemas.PreferredSlotDto.properties.startAt.format,
      "date-time",
    );
    assert.equal(schemas.PreferredSlotDto.properties.endAt.format, "date-time");
    assert.equal(create.currentLevel.nullable, true);
    assert.equal(create.expiresAt.format, "date-time");
    assert.equal(create.expiresAt.nullable, true);
    const routes = document.paths["/api/v1/learning-requests"];
    assert.equal(
      routes.post.requestBody.content["application/json"].schema.$ref,
      "#/components/schemas/CreateLearningRequestDto",
    );
    assert.deepEqual(
      new Set(routes.get.parameters.map(({ name }) => name)),
      new Set(["skillId", "tagIds", "keyword", "status", "limit", "cursor"]),
    );
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
      for (const field of [
        "teachingOverview",
        "offeredSharingSkills",
        "desiredCreditPerHour",
        "preferredAvailability",
      ]) {
        assert.ok(schemas[name].properties[field], `${name}.${field}`);
      }
    }
    for (const name of [
      "LearningRequestOwnerResponse",
      "LearningRequestModerationResponse",
    ]) {
      assert.equal(schemas[name].properties.proposedTags.items.type, "string");
    }
    assert.equal(
      schemas.LearningRequestSummaryResponse.properties.proposedTags,
      undefined,
    );
  } finally {
    await app.close();
  }
});
