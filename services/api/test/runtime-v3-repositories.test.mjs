import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaUsersRepository } from "../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { ProfileReader } from "../dist/modules/users/application/services/profile-reader.service.js";

test("single-role changes are idempotent and Staff operations cannot demote Admin", async () => {
  const roles = Object.fromEntries(
    ["USER", "STAFF", "ADMIN"].map((code) => [code, { id: code, code }]),
  );
  const account = { id: "fixture", roleId: "USER" };
  let writes = 0;
  const tx = {
    role: { findUniqueOrThrow: async ({ where }) => roles[where.code] },
    user: {
      findUniqueOrThrow: async () => ({
        ...account,
        roleIdRecord: roles[account.roleId],
      }),
      update: async ({ data }) => {
        writes++;
        Object.assign(account, data);
        return account;
      },
    },
  };
  const repository = new PrismaUsersRepository();
  assert.equal(await repository.role(tx, account.id, "STAFF", true), true);
  assert.equal(account.roleId, "STAFF");
  assert.equal(await repository.role(tx, account.id, "STAFF", true), false);
  assert.equal(await repository.role(tx, account.id, "STAFF", false), true);
  assert.equal(account.roleId, "USER");
  await repository.role(tx, account.id, "ADMIN", true);
  await assert.rejects(
    repository.role(tx, account.id, "STAFF", true),
    (error) => error.getStatus() === 400,
  );
  assert.equal(await repository.role(tx, account.id, "STAFF", false), false);
  assert.equal(account.roleId, "ADMIN");
  assert.equal(writes, 3);
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
  const tx = { user: { findUnique: async () => user } };
  const reader = new ProfileReader(tx, repository, {
    url: async () => "https://fixture.invalid/signed",
  });
  const profile = await reader.profile(user.id, true);
  assert.equal(profile.fullName, user.fullName);
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

test("grants come only from the user's one assigned role", async () => {
  const repository = new PrismaUsersRepository();
  const tx = {
    user: {
      findUniqueOrThrow: async () => ({
        roleIdRecord: {
          code: "STAFF",
          rolePermissionRoleIdRecords: [
            { permissionIdRecord: { code: "users.read" } },
            { permissionIdRecord: { code: "users.read" } },
          ],
        },
      }),
    },
  };
  assert.deepEqual(await repository.grants(tx, "fixture"), {
    roles: ["STAFF"],
    permissions: ["users.read"],
  });
});
