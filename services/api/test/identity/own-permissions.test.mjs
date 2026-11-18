import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GetOwnIdentityUseCase } from "../../dist/modules/users/application/use-cases/get-own-identity.use-case.js";
import { UsersService } from "../../dist/modules/users/application/services/users.service.js";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { OwnIdentityResponse } from "../../dist/modules/users/presentation/http/users.responses.js";

function fixture(role, defaults, participation = [], overrides = []) {
  const permissionRows = (codes) =>
    codes.map((code) => ({ permissionIdRecord: { code } }));
  const user = {
    id: "current-user",
    normalizedEmail: "current@example.com",
    emailVerified: true,
    accountStatus: "ACTIVE",
    roleIdRecord: {
      code: role,
      rolePermissionRoleIdRecords: permissionRows(defaults),
    },
  };
  const tx = {
    user: { findUniqueOrThrow: async () => user },
    rolePermission: { findMany: async () => permissionRows(participation) },
    userPermissionOverride: {
      findMany: async () =>
        overrides.map(({ code, effect }) => ({ permission: { code }, effect })),
    },
  };
  const repository = new PrismaUsersRepository();
  const profile = { fullName: "Current User" };
  const useCase = new GetOwnIdentityUseCase(
    tx,
    repository,
    new UsersService(repository, {}),
    { profile: async () => profile },
  );
  return { useCase, overrides, profile };
}

test("own identity exposes current resolved STAFF GRANT/DENY permissions", async () => {
  const { useCase, profile } = fixture(
    "STAFF",
    ["material:moderate"],
    ["proposal:create"],
    [
      { code: "material:moderate", effect: "DENY" },
      { code: "report:moderate", effect: "GRANT" },
      { code: "credit:adjust", effect: "GRANT" },
    ],
  );
  const result = await useCase.execute("current-user");
  assert.deepEqual(result.permissions, ["proposal:create", "report:moderate"]);
  assert.deepEqual(result.roles, ["STAFF"]);
  assert.equal(result.profile, profile);
  assert.equal(result.email, "current@example.com");
  assert.ok(!("roleIdRecord" in result));
});

test("own identity reflects revoked grants on the next read without cached role claims", async () => {
  const { useCase, overrides } = fixture(
    "STAFF",
    [],
    [],
    [{ code: "report:moderate", effect: "GRANT" }],
  );
  assert.deepEqual((await useCase.execute("current-user")).permissions, [
    "report:moderate",
  ]);
  overrides[0].effect = "DENY";
  assert.deepEqual((await useCase.execute("current-user")).permissions, []);
});

test("USER and ADMIN identity permissions use only their assigned role with stable ordering", async () => {
  for (const role of ["USER", "ADMIN"]) {
    const { useCase } = fixture(
      role,
      ["users.read", "material:read", "users.read"],
      ["proposal:create"],
      [{ code: "report:moderate", effect: "GRANT" }],
    );
    const result = await useCase.execute("current-user");
    assert.deepEqual(result.permissions, ["material:read", "users.read"]);
    assert.deepEqual(result.roles, [role]);
  }
});

test("own identity Swagger declares effective permissions as an array of strings", () => {
  const metadata = Reflect.getMetadata(
    "swagger/apiModelProperties",
    OwnIdentityResponse.prototype,
    "permissions",
  );
  assert.equal(metadata?.type, String);
  assert.equal(metadata?.isArray, true);
  assert.match(metadata?.description ?? "", /GRANT.*DENY/);
});
