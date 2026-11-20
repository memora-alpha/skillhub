import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { RegisterUseCase } from "../../dist/modules/auth/application/use-cases/register.use-case.js";
import { VerifyEmailUseCase } from "../../dist/modules/auth/application/use-cases/verify-email.use-case.js";
import { UpdateProfileUseCase } from "../../dist/modules/users/application/use-cases/update-profile.use-case.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/services/sharing-skills.service.js";
import { TagRequestsService } from "../../dist/modules/skills/application/services/tag-requests.service.js";
import { VerificationsService } from "../../dist/modules/verifications/application/services/verifications.service.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import {
  A,
  conversationId,
  plan,
  setup,
  user,
} from "../learning-platform/fixtures.mjs";

const blocked = { outcome: "BLOCK" };
const rejected = (error) =>
  error.getStatus?.() === 422 && error.message === "CONTENT_MODERATION_BLOCKED";
const noWrite = () => assert.fail("rejected content was persisted");

function classifier(surface, fields) {
  return {
    mode: () => "enforce",
    async evaluateText(actualSurface, _sourceVersion, actualFields) {
      assert.equal(actualSurface, surface);
      assert.deepEqual(actualFields, fields);
      return blocked;
    },
  };
}

test("registration screens the submitted public name before staging an OTP", async () => {
  const register = new RegisterUseCase(
    {},
    { crypto: { hashPassword: async () => "hash" } },
    { byEmail: async () => null },
    { requestRegistration: noWrite },
    classifier("profile", ["Prohibited display name"]),
  );
  await assert.rejects(
    register.execute({
      email: "learner@example.test",
      fullName: "Prohibited display name",
      password: "An Example Password",
    }),
    rejected,
  );
});

test("email verification screens a pending registration name created before rollout", async () => {
  const db = { $transaction: (work) => work({ $queryRaw: async () => [] }) };
  const verify = new VerifyEmailUseCase(
    db,
    { byEmail: async () => null, create: noWrite },
    {},
    {
      verify: async (_email, _purpose, _code, work) =>
        work({ id: "proof", userId: A }),
      registration: () => ({ fullName: "Prohibited display name" }),
    },
    classifier("profile", ["Prohibited display name"]),
  );
  await assert.rejects(
    verify.execute("learner@example.test", "123456"),
    rejected,
  );
});

test("profile changes reject disallowed public text before updating the record", async () => {
  const tx = { $queryRaw: async () => [] };
  const profile = new UpdateProfileUseCase(
    { $transaction: (work) => work(tx) },
    { byId: async () => ({ id: A }), updateProfile: noWrite },
    {},
    classifier("profile", [
      "Prohibited name",
      "Prohibited headline",
      "Prohibited bio",
    ]),
  );
  await assert.rejects(
    profile.execute(A, {
      fullName: "Prohibited name",
      headline: "Prohibited headline",
      bio: "Prohibited bio",
      locale: "vi",
    }),
    rejected,
  );
});

test("profile text cannot be published after the authenticated session is revoked during classification", async () => {
  const tx = { $queryRaw: async () => [] };
  let revoked = false;
  const profile = new UpdateProfileUseCase(
    { $transaction: (work) => work(tx) },
    { byId: async () => ({ id: A }), updateProfile: noWrite },
    {},
    {
      mode: () => "enforce",
      async evaluateText() {
        revoked = true;
        return { outcome: "ALLOW" };
      },
    },
    {
      async assertLive() {
        if (revoked) throw new UnauthorizedException();
      },
    },
  );
  await assert.rejects(
    profile.execute(user(A), { fullName: "A new public name" }),
    (error) => error.getStatus?.() === 401,
  );
});

test("sharing skill creation screens the normalized description before publication", async () => {
  const description = "A disallowed skill description";
  const tx = {
    idempotencyRecord: { findUnique: async () => null },
    $executeRaw: noWrite,
  };
  const transactions = { run: (work) => work(tx) };
  const service = new SharingSkillsService(
    { create: noWrite },
    { assertActive: async () => {}, selectLevel: async () => ({}) },
    { require: async () => ({ userId: A }) },
    new IdempotencyService(transactions),
    transactions,
    {},
    {},
    {},
    classifier("sharing_skill", [description]),
  );
  await assert.rejects(
    service.create(
      { principal: user(A), key: "skill-create" },
      {
        skillId: "skill",
        description: ` ${description} `,
      },
    ),
    rejected,
  );
});

test("a disallowed proposed tag never enters the approval queue", async () => {
  const tx = {
    idempotencyRecord: { findUnique: async () => null },
    $executeRaw: noWrite,
  };
  const transactions = { run: (work) => work(tx) };
  const service = new TagRequestsService(
    { findByKey: async () => null, createRequest: noWrite },
    {
      require: async () => ({
        userId: A,
        roles: ["USER"],
        blockedPermissions: new Set(),
      }),
    },
    new IdempotencyService(transactions),
    transactions,
    {},
    classifier("tag_request", ["Disallowed tag"]),
  );
  await assert.rejects(
    service.create(
      { principal: user(A), key: "tag-create" },
      { label: " Disallowed tag " },
    ),
    rejected,
  );
});

test("disallowed skill verification evidence text never enters the review queue", async () => {
  const tx = {
    idempotencyRecord: { findUnique: async () => null },
    $executeRaw: noWrite,
  };
  const transactions = { run: (work) => work(tx) };
  const service = new VerificationsService(
    { pending: async () => null, create: noWrite },
    { assertOwnedActive: async () => ({ userId: A, version: 1 }) },
    { require: async () => ({ userId: A, roles: ["USER"] }) },
    new IdempotencyService(transactions),
    transactions,
    {},
    {},
    {},
    {},
    classifier("sharing_skill", [
      "Evidence title",
      "Disallowed evidence description",
    ]),
  );
  await assert.rejects(
    service.submit(
      { principal: user(A), key: "evidence-submit" },
      "sharing-id",
      {
        fileIds: ["file-id"],
        title: "Evidence title",
        description: "Disallowed evidence description",
      },
    ),
    rejected,
  );
});

test("a rejected learning plan outline cannot create a plan visible to its learner", async () => {
  const fields = ["Recognizable goal", "Disallowed session outline"];
  const ctx = setup({ moderation: classifier("learning_path", fields) });
  const path = await ctx.paths.create(user(A), {
    conversationId,
    exchangeType: "TWO_WAY",
    totalCreditPerUser: "20.00",
  });
  await assert.rejects(
    ctx.paths.addPlan(user(A), path.id, {
      ...plan(),
      learningGoal: fields[0],
      sessionOutline: [{ content: fields[1] }],
    }),
    rejected,
  );
  assert.equal(
    await ctx.db.learningPlan.count({ where: { pathId: path.id } }),
    0,
  );
});
