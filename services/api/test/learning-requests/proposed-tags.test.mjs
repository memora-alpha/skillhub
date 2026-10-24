import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { ValidationPipe, ForbiddenException, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SkillsModule } from "../../dist/modules/skills/skills.module.js";
import { DatabaseModule } from "../../dist/infrastructure/database/database.module.js";
import { IdentityModule } from "../../dist/modules/identity.module.js";
import { AuditModule } from "../../dist/modules/audit/audit.module.js";
import { IdempotencyModule } from "../../dist/infrastructure/idempotency/idempotency.module.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { prepareLearningRequestContent } from "../../dist/modules/learning-requests/domain/request-text.policy.js";
import {
  CreateLearningRequestDto,
  EditLearningRequestDto,
} from "../../dist/modules/learning-requests/presentation/http/learning-requests.dto.js";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";
import { PublishLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/publish-learning-request.use-case.js";
import { EditLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/edit-learning-request.use-case.js";
import { ModerateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/moderate-learning-request.use-case.js";
import { LearningRequestTagsService } from "../../dist/modules/skills/application/services/learning-request-tags.service.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";

const now = new Date("2026-10-24T00:00:00Z");
const owner = {
  userId: randomUUID(),
  roles: ["USER"],
  permissions: ["learning-request:create", "learning-request:update:self"],
};
const staff = {
  userId: randomUUID(),
  roles: ["STAFF"],
  permissions: ["learning-request:approve", "learning-request:reject"],
};
const context = { requestId: randomUUID(), correlationId: randomUUID() };
const skillId = randomUUID();
const input = (patch = {}) => ({
  skillId,
  title: "Learn useful programming skills",
  description: "I want to learn programming with practical projects.",
  learningGoal: "Build an application with a teacher.",
  ...patch,
});
const status = (code) => (error) => error.getStatus?.() === code;

test("production SkillsModule exports the inline tag approver with its owner dependencies", async () => {
  const stubModule = (tokens) => {
    class FixtureModule {}
    Module({
      providers: tokens.map((provide) => ({ provide, useValue: {} })),
      exports: tokens,
    })(FixtureModule);
    return FixtureModule;
  };
  const module = await Test.createTestingModule({ imports: [SkillsModule] })
    .overrideModule(DatabaseModule)
    .useModule(stubModule([PrismaService, TransactionRunner]))
    .overrideModule(IdentityModule)
    .useModule(stubModule([SkillActorService, SessionsService, IdentityGuard]))
    .overrideModule(AuditModule)
    .useModule(stubModule([AuditWriter]))
    .overrideModule(IdempotencyModule)
    .useModule(stubModule([IdempotencyService]))
    .compile();
  try {
    assert.ok(
      module.get(LearningRequestTagsService) instanceof
        LearningRequestTagsService,
    );
  } finally {
    await module.close();
  }
});

// Copy-on-write models the caller's transaction. Services and real audit
// validation run together so downstream failures must leave the store untouched.
function fixture(options = {}) {
  let store = { request: null, tags: [], audits: [], events: [] };
  const transactions = {
    run: async (work) => {
      const state = structuredClone(store);
      const tx = {
        state,
        $queryRaw: async () => [],
        auditLog: {
          create: async ({ data }) => {
            if (options.auditFailure === data.action)
              throw new Error("audit unavailable");
            state.audits.push(data);
            return { id: data.id };
          },
        },
      };
      const result = await work(tx);
      store = state;
      return result;
    },
  };
  const access = {
    assertUserAction: async (_tx, actor, permission) => {
      if (!actor.permissions.includes(permission))
        throw new ForbiddenException();
      return actor;
    },
  };
  access.assertAction = access.assertUserAction;
  const catalog = {
    assertActiveSelection: async (tx, selection) => ({
      skillId: selection.skillId,
      tags: selection.tagIds.map((id) => {
        const tag = tx.state.tags.find(
          (tag) => tag.id === id && tag.status === "ACTIVE",
        );
        if (!tag) throw new Error("tag not active");
        return tag;
      }),
    }),
  };
  const save = (tx, version, from, content) => {
    const row = tx.state.request;
    if (row.version !== version || (from && !from.includes(row.status)))
      return false;
    const { tagIds, ...fields } = content;
    Object.assign(row, fields, { version: version + 1 });
    if (tagIds) row.tagLinks = tagIds.map((tagId) => ({ tagId }));
    return true;
  };
  const repository = {
    databaseNow: async () => now,
    get: async (tx) => structuredClone(tx.state.request),
    lock: async (tx) => structuredClone(tx.state.request),
    create: async (tx, content) => {
      tx.state.request = {
        id: randomUUID(),
        ...content,
        tagLinks: content.tagIds.map((tagId) => ({ tagId })),
        status: "DRAFT",
        moderationStatus: "NOT_REQUIRED",
        moderationRejectReason: null,
        version: 1,
        publishedAt: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      };
      return tx.state.request;
    },
    transition: async (tx, _id, version, from, content) =>
      save(tx, version, from, content),
    replaceContent: async (tx, _id, version, content) =>
      save(tx, version, null, content),
  };
  const configuration = {
    getSnapshot: async () => ({
      values: {
        "learningRequest.moderationRuleSet": {
          rules: [{ category: "BLOCKED", pattern: "prohibited" }],
        },
      },
      versions: { "learningRequest.moderationRuleSet": 1 },
    }),
  };
  const audit = new AuditWriter(new AuditRepository());
  const tagRepository = {
    createTagIfAbsent: async (tx, selection) => {
      const found = tx.state.tags.find(
        (tag) => tag.labelKey === selection.labelKey,
      );
      if (found) return { row: found, created: false };
      const row = {
        id: randomUUID(),
        ...selection,
        status: "ACTIVE",
        version: 1,
      };
      tx.state.tags.push(row);
      return { row, created: true };
    },
  };
  const actors = {
    require: async (tx, actor, permission) =>
      access.assertAction(tx, actor, permission),
  };
  const tags = new LearningRequestTagsService(tagRepository, actors, audit);
  const create = new CreateLearningRequestUseCase(
    transactions,
    access,
    { assertAllowed: async () => {} },
    catalog,
    repository,
  );
  const publish = new PublishLearningRequestUseCase(
    transactions,
    access,
    { assertAllowed: async () => {} },
    repository,
    catalog,
    configuration,
  );
  const edit = new EditLearningRequestUseCase(
    transactions,
    access,
    catalog,
    repository,
    configuration,
  );
  const moderate = new ModerateLearningRequestUseCase(
    transactions,
    access,
    repository,
    audit,
    { append: async (tx, event) => tx.state.events.push(event) },
    undefined,
    tags,
  );
  return {
    get store() {
      return store;
    },
    create,
    publish,
    edit,
    moderate,
    tags,
    transactions,
    async post(labels = ["  React   Native  "], tagIds = []) {
      const draft = await create.execute(
        owner,
        input({ proposedTags: labels, tagIds }),
      );
      return publish.execute(owner, draft.id, {
        expectedVersion: draft.version,
      });
    },
    approve(actor = staff, expectedVersion = store.request.version) {
      return moderate.execute(
        actor,
        store.request.id,
        "APPROVE",
        { expectedVersion, reason: "Reviewed post and proposed tags" },
        context,
      );
    },
  };
}

test("proposed labels use canonical normalization; invalid, duplicate and oversized selections fail", () => {
  assert.deepEqual(
    prepareLearningRequestContent(
      input({ proposedTags: ["  Học   React  "] }),
      now,
    ).proposedTags,
    ["Học React"],
  );
  for (const proposedTags of [
    null,
    "React",
    [""],
    ["x".repeat(81)],
    ["React", " react "],
    ["Học", "Học"],
    ["bad\nlabel"],
    [12],
    Array.from({ length: 11 }, (_, i) => `Tag ${i}`),
  ]) {
    assert.throws(
      () => prepareLearningRequestContent(input({ proposedTags }), now),
      status(400),
    );
  }
  assert.throws(
    () =>
      prepareLearningRequestContent(
        input({
          proposedTags: ["React"],
          tagIds: Array.from({ length: 10 }, () => randomUUID()),
        }),
        now,
      ),
    status(400),
  );
});

test("HTTP create and PATCH accept proposedTags, and reject null/non-string labels", async () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  for (const metatype of [CreateLearningRequestDto, EditLearningRequestDto]) {
    const body =
      metatype === CreateLearningRequestDto ? input() : { expectedVersion: 1 };
    const result = await pipe.transform(
      { ...body, proposedTags: ["React"] },
      { type: "body", metatype },
    );
    assert.deepEqual(result.proposedTags, ["React"]);
    for (const value of [null, "React", [42]]) {
      await assert.rejects(
        () =>
          pipe.transform(
            { ...body, proposedTags: value },
            { type: "body", metatype },
          ),
        status(400),
      );
    }
  }
});

test("create saves proposals only on the post; publish queues safe text for Staff review", async () => {
  const f = fixture();
  const post = await f.post();
  assert.equal(post.status, "PENDING_MODERATION");
  assert.equal(post.moderationStatus, "PENDING");
  assert.deepEqual(post.proposedTags, ["React Native"]);
  assert.deepEqual(f.store.request.flaggedCategories, ["PROPOSED_TAGS"]);
  assert.deepEqual(f.store.tags, []);
});

test("Staff approval creates ACTIVE canonical tags, attaches IDs and clears proposals atomically", async () => {
  const f = fixture();
  const existing = {
    id: randomUUID(),
    label: "React Native",
    labelKey: "react native",
    status: "ACTIVE",
    version: 1,
    createdByUserId: staff.userId,
  };
  f.store.tags.push(existing);
  await f.post(["React Native", "TypeScript"], [existing.id]);
  const result = await f.approve();
  assert.equal(result.status, "OPEN");
  assert.equal(result.moderationStatus, "APPROVED");
  assert.deepEqual(result.proposedTags, []);
  assert.equal(result.tagIds.length, 2);
  assert.equal(f.store.tags.length, 2);
  assert.equal(f.store.tags[1].createdByUserId, staff.userId);
  assert.equal(
    f.store.audits.filter((row) => row.action === "TAG_CREATE").length,
    1,
  );
  const review = f.store.audits.find(
    (row) => row.action === "LEARNING_REQUEST_MODERATE",
  );
  assert.deepEqual(review.before.proposedTags, ["React Native", "TypeScript"]);
  assert.deepEqual(review.after.tagIds, result.tagIds);
  const before = structuredClone(f.store);
  await assert.rejects(() => f.approve(staff, 2), status(409));
  assert.deepEqual(f.store, before);
});

test("rejected posts keep proposals for correction without creating catalog tags", async () => {
  const f = fixture();
  const post = await f.post();
  const result = await f.moderate.execute(
    staff,
    post.id,
    "REJECT",
    {
      expectedVersion: post.version,
      reason: "Please correct the proposed tags",
    },
    context,
  );
  assert.deepEqual(result.proposedTags, ["React Native"]);
  assert.deepEqual(f.store.tags, []);
  assert.equal(f.store.events[0].type, "learning-request.rejected");
  const revised = await f.edit.execute(owner, post.id, {
    expectedVersion: result.version,
    proposedTags: ["React"],
  });
  assert.equal(revised.status, "DRAFT");
  const resubmitted = await f.publish.execute(owner, post.id, {
    expectedVersion: revised.version,
  });
  assert.equal(resubmitted.status, "PENDING_MODERATION");
});

test("PATCH omission preserves pending proposals; [] clears; adding proposals to OPEN queues again", async () => {
  const f = fixture();
  let post = await f.post();
  post = await f.edit.execute(owner, post.id, {
    expectedVersion: post.version,
    title: "Learn useful programming with a mentor",
  });
  assert.deepEqual(post.proposedTags, ["React Native"]);
  assert.equal(post.status, "PENDING_MODERATION");
  post = await f.edit.execute(owner, post.id, {
    expectedVersion: post.version,
    proposedTags: [],
  });
  assert.equal(post.status, "OPEN");
  post = await f.edit.execute(owner, post.id, {
    expectedVersion: post.version,
    proposedTags: ["React"],
  });
  assert.equal(post.status, "PENDING_MODERATION");
  await assert.rejects(() => f.approve(staff, 2), status(409));
  assert.deepEqual(f.store.tags, []);
});

for (const action of ["TAG_CREATE", "LEARNING_REQUEST_MODERATE"]) {
  test(`${action} audit failure rolls back tags, post status and tag links`, async () => {
    const f = fixture({ auditFailure: action });
    await f.post();
    const before = structuredClone(f.store);
    await assert.rejects(() => f.approve(), /audit unavailable/);
    assert.deepEqual(f.store, before);
  });
}

test("inactive duplicate rolls back other new tags and keeps the post pending", async () => {
  const f = fixture();
  f.store.tags.push({
    id: randomUUID(),
    label: "React Native",
    labelKey: "react native",
    status: "INACTIVE",
  });
  await f.post(["New first tag", "React Native"]);
  const before = structuredClone(f.store);
  await assert.rejects(
    () => f.approve(),
    (error) => error.message === "TAG_UNAVAILABLE",
  );
  assert.deepEqual(f.store, before);
});

test("USER with an incorrectly granted review permission cannot approve tags through either boundary", async () => {
  const f = fixture();
  await f.post();
  const actor = { ...owner, permissions: staff.permissions };
  const before = structuredClone(f.store);
  await assert.rejects(() => f.approve(actor), status(403));
  await assert.rejects(
    () =>
      f.transactions.run((tx) =>
        f.tags.approveForRequest(
          tx,
          actor,
          ["React"],
          f.store.request.id,
          context,
        ),
      ),
    status(403),
  );
  await assert.rejects(
    () => f.approve({ ...staff, permissions: [] }),
    status(403),
  );
  assert.deepEqual(f.store, before);
});
