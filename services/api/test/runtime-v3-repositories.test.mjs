import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaUsersRepository } from "../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { ProfileReader } from "../dist/modules/users/application/services/profile-reader.service.js";

test("single-role changes are idempotent and Staff operations cannot demote Admin", async () => {
  const roles = Object.fromEntries(
    ["USER", "STAFF", "ADMIN"].map((code) => [code, { id: code, code }]),
  );
  const account = {
    id: "fixture",
    roleId: "USER",
    securityVersion: 1,
    staffPermissionVersion: 0,
  };
  let writes = 0,
    cleared = 0;
  const tx = {
    userPermissionOverride: {
      deleteMany: async () => {
        cleared++;
      },
    },
    role: { findUniqueOrThrow: async ({ where }) => roles[where.code] },
    user: {
      findUniqueOrThrow: async () => ({
        ...account,
        roleIdRecord: roles[account.roleId],
      }),
      update: async ({ data }) => {
        writes++;
        for (const [key, value] of Object.entries(data)) {
          account[key] =
            typeof value === "object" ? account[key] + value.increment : value;
        }
        return account;
      },
    },
  };
  const repository = new PrismaUsersRepository();
  assert.equal(await repository.role(tx, account.id, "STAFF", true), true);
  assert.equal(account.roleId, "STAFF");
  assert.equal(account.securityVersion, 2);
  assert.equal(await repository.role(tx, account.id, "STAFF", true), false);
  assert.equal(await repository.role(tx, account.id, "STAFF", false), true);
  assert.equal(account.roleId, "USER");
  assert.equal(account.securityVersion, 3);
  await repository.role(tx, account.id, "ADMIN", true);
  assert.equal(account.securityVersion, 3);
  await assert.rejects(
    repository.role(tx, account.id, "STAFF", true),
    (error) => error.getStatus() === 400,
  );
  assert.equal(await repository.role(tx, account.id, "STAFF", false), false);
  assert.equal(account.roleId, "ADMIN");
  assert.equal(writes, 3);
  assert.equal(cleared, 3);
  assert.equal(account.staffPermissionVersion, 3);
});

test("v3 inline profile preserves the public projection and hides account secrets", async () => {
  const user = {
    id: "fixture",
    accountStatus: "ACTIVE",
    fullName: "Test User",
    headline: null,
    bio: null,
    reputationScore: 50,
    verifiedSkillCount: 0,
    completedSessionCount: 0,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi",
    passwordHash: "private",
    normalizedEmail: "private@example.com",
    selectedAvatarRecord: { state: "CLEAN", storageKey: "private-object-key" },
  };
  const repository = new PrismaUsersRepository();
  const tx = {
    user: { findUnique: async () => user },
    learningPath: { count: async () => 3 },
  };
  const reader = new ProfileReader(tx, repository, {
    url: async () => "https://fixture.invalid/signed",
  });
  const profile = await reader.profile(user.id, true);
  assert.equal(profile.fullName, user.fullName);
  assert.equal(profile.completedLearningPathCount, 3);
  assert.equal(profile.headline, "");
  assert.equal(profile.bio, "");
  assert.equal(profile.avatarUrl, "https://fixture.invalid/signed");
  assert.equal(profile.reputationScore, 50);
  for (const secret of [
    "passwordHash",
    "normalizedEmail",
    "selectedAvatarRecord",
    "roleId",
    "timezone",
  ])
    assert.equal(secret in profile, false);
});

test("Staff keeps one role while inheriting USER participation and applying operational overrides", async () => {
  const repository = new PrismaUsersRepository();
  const tx = {
    rolePermission: {
      findMany: async () => [
        { permissionIdRecord: { code: "proposal:create" } },
      ],
    },
    userPermissionOverride: {
      findMany: async () => [
        { permission: { code: "report:moderate" }, effect: "DENY" },
        { permission: { code: "report:group" }, effect: "GRANT" },
        { permission: { code: "credit:adjust" }, effect: "GRANT" },
      ],
    },
    user: {
      findUniqueOrThrow: async () => ({
        roleIdRecord: {
          code: "STAFF",
          rolePermissionRoleIdRecords: [
            { permissionIdRecord: { code: "users.read" } },
            { permissionIdRecord: { code: "users.read" } },
            { permissionIdRecord: { code: "report:moderate" } },
          ],
        },
      }),
    },
  };
  assert.deepEqual(await repository.grants(tx, "fixture"), {
    roles: ["STAFF"],
    permissions: ["proposal:create", "report:group", "users.read"],
  });
});

test("USER and ADMIN use their assigned grants without Staff inheritance or overrides", async () => {
  const repository = new PrismaUsersRepository();
  for (const code of ["USER", "ADMIN"]) {
    const tx = {
      user: {
        findUniqueOrThrow: async () => ({
          roleIdRecord: {
            code,
            rolePermissionRoleIdRecords: [
              { permissionIdRecord: { code: "users.read" } },
              { permissionIdRecord: { code: "users.read" } },
            ],
          },
        }),
      },
    };
    assert.deepEqual(await repository.grants(tx, "fixture"), {
      roles: [code],
      permissions: ["users.read"],
    });
  }
});
