import assert from "node:assert/strict";
import { test } from "node:test";
import { PERMISSION_CATALOG } from "../../dist/shared/authorization/permission.catalog.js";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";

const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const principal = (roles, permissions) => ({
  userId,
  sessionId,
  securityVersion: 1,
  roles,
  permissions,
});
const status = (error) => error?.getStatus?.();

test("permission catalog keeps Learning Request actions distinct and explicit", () => {
  const codes = PERMISSION_CATALOG.map(({ code }) => code);
  for (const code of [
    "learning-request:create",
    "learning-request:read",
    "learning-request:update:self",
    "learning-request:cancel:self",
    "learning-request:moderation:read",
    "learning-request:approve",
    "learning-request:reject",
    "learning-request:moderation:configure",
    "notification:read:self",
    "notification:update:self",
  ]) {
    assert.ok(codes.includes(code), `missing permission ${code}`);
  }
  assert.equal(new Set(codes).size, codes.length);
});

test("action check uses the live session grants and returns the refreshed principal", async () => {
  const tx = {};
  let seen;
  const live = principal(["USER"], ["learning-request:create"]);
  const access = new LearningRequestAccessService({
    assertLive: async (passedTx, actor) => {
      seen = { passedTx, actor };
      return live;
    },
  });

  assert.equal(
    await access.assertAction(
      tx,
      principal(["USER"], []),
      "learning-request:create",
    ),
    live,
  );
  assert.deepEqual(seen, { passedTx: tx, actor: principal(["USER"], []) });
});

test("a revoked action fails after the current grants are reloaded", async () => {
  const access = new LearningRequestAccessService({
    assertLive: async (_tx, actor) => ({ ...actor, permissions: [] }),
  });

  await assert.rejects(
    access.assertAction(
      {},
      principal(["STAFF"], ["learning-request:approve"]),
      "learning-request:approve",
    ),
    (error) => status(error) === 403,
  );
});

test("read scope accepts only an explicit live public-read or moderation-read grant", async () => {
  const live = principal(["STAFF"], ["learning-request:moderation:read"]);
  const access = new LearningRequestAccessService({
    assertLive: async (_tx, actor) =>
      actor.roles.includes("STAFF")
        ? { ...actor, permissions: live.permissions }
        : actor,
  });
  assert.deepEqual(
    await access.assertAnyAction({}, principal(["STAFF"], []), [
      "learning-request:read",
      "learning-request:moderation:read",
    ]),
    live,
  );
  await assert.rejects(
    access.assertAnyAction({}, principal(["USER"], []), [
      "learning-request:read",
      "learning-request:moderation:read",
    ]),
    (error) => status(error) === 403,
  );
});

test("create and publish require both an explicit action and the USER role", async () => {
  const access = new LearningRequestAccessService({
    assertLive: async (_tx, actor) => actor,
  });

  assert.equal(
    (
      await access.assertUserAction(
        {},
        principal(["USER"], ["learning-request:create"]),
        "learning-request:create",
      )
    ).userId,
    userId,
  );
  await assert.rejects(
    access.assertUserAction(
      {},
      principal(["ADMIN"], ["learning-request:create"]),
      "learning-request:create",
    ),
    (error) => status(error) === 403,
  );
  await assert.rejects(
    access.assertUserAction(
      {},
      principal(["USER"], ["learning-request:read"]),
      "learning-request:create",
    ),
    (error) => status(error) === 403,
  );
});

test("bootstrap grants only the chosen per-role actions and preserves existing grants", async () => {
  const calls = { roles: [], permissions: [], grants: [] };
  const tx = {
    role: {
      createMany: async (input) => calls.roles.push(input),
      findMany: async ({ where }) =>
        where.code.in.map((code) => ({ id: code, code })),
    },
    permission: {
      createMany: async (input) => calls.permissions.push(input),
      findMany: async ({ where }) =>
        where.code.in.map((code) => ({ id: code, code })),
    },
    rolePermission: {
      createMany: async (input) => calls.grants.push(input),
    },
  };

  await new PrismaUsersRepository().seedRoles(tx);

  const grants = new Map();
  for (const item of calls.grants.flatMap(({ data }) => data)) {
    const current = grants.get(item.roleId) ?? new Set();
    current.add(item.permissionId);
    grants.set(item.roleId, current);
  }
  assert.deepEqual(
    [...grants.get("USER")],
    [
      "proposal:create",
      "event:read:self",
      "proposal:read:party",
      "proposal:update:self",
      "proposal:accept:recipient",
      "proposal:reject:recipient",
      "proposal:withdraw:self",
      "conversation:read:participant",
      "message:create:participant",
      "message:delivery:read:self",
      "conversation:read-state:update:self",
      "message:attachment:create:participant",
      "message:attachment:read:participant",
      "learning-request:create",
      "learning-request:read",
      "learning-request:update:self",
      "learning-request:cancel:self",
      "notification:read:self",
      "notification:update:self",
      "sharing-skill:create:self",
      "sharing-skill:update:self",
      "sharing-skill:archive:self",
      "skill-verification:submit:self",
    ],
  );
  assert.deepEqual(
    [...grants.get("STAFF")],
    [
      "learning-request:moderation:read",
      "learning-request:approve",
      "learning-request:reject",
      "report:moderate",
      "sharing-skill:create:self",
      "sharing-skill:update:self",
      "sharing-skill:archive:self",
      "skill-verification:submit:self",
      "skill-verification:read",
      "skill-verification:approve",
      "skill-verification:reject",
    ],
  );
  for (const permission of [
    "learning-request:moderation:read",
    "learning-request:approve",
    "learning-request:reject",
    "learning-request:moderation:configure",
  ]) {
    assert.ok(
      grants.get("ADMIN")?.has(permission),
      `ADMIN missing ${permission}`,
    );
  }
  assert.ok(calls.grants.every(({ skipDuplicates }) => skipDuplicates));
  assert.equal(grants.get("USER").has("skill-catalog:create"), false);
  assert.equal(grants.get("STAFF").has("skill-verification:revoke"), false);
  for (const role of ["STAFF", "ADMIN"]) {
    assert.equal(grants.get(role).has("event:read:self"), false);
    assert.equal(grants.get(role).has("conversation:read:participant"), false);
  }
  assert.ok(grants.get("ADMIN").has("skill-catalog:create"));
  assert.equal(
    new Set(calls.permissions[0].data.map((row) => row.code)).size,
    calls.permissions[0].data.length,
  );
});
