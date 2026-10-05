import assert from "node:assert/strict";
import { test } from "node:test";
import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { NestFactory } from "@nestjs/core";
import { AUTHORIZATION_READER } from "../dist/shared/authorization/authorization.types.js";
import { AccessControlService } from "../dist/shared/authorization/access-control.service.js";
import { RequirePermissions } from "../dist/shared/authorization/access.decorators.js";
import { PermissionGuard } from "../dist/shared/authorization/permission.guard.js";
import { CheckResource } from "../dist/shared/authorization/check-resource.decorator.js";
import { ResourceAccessGuard } from "../dist/shared/authorization/resource-access.guard.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const skillId = "33333333-3333-4333-8333-333333333333";
const users = new Map([
  [
    alice,
    {
      userId: alice,
      accountStatus: "ACTIVE",
      roles: ["USER"],
      permissions: new Set(["sharing-skill:update:self"]),
      blockedPermissions: new Set(),
    },
  ],
  [
    bob,
    {
      userId: bob,
      accountStatus: "ACTIVE",
      roles: ["ADMIN"],
      permissions: new Set(["sharing-skill:update:self"]),
      blockedPermissions: new Set(),
    },
  ],
]);
const reader = { loadActor: async (userId) => users.get(userId) ?? null };

class FixtureIdentityGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization;
    if (token === "Bearer fixture-alice" || token === "Bearer fixture-bob") {
      request.authenticatedIdentity = {
        userId: token === "Bearer fixture-alice" ? alice : bob,
        sessionId: "fixture-only",
      };
    }
    return true;
  }
}
Injectable()(FixtureIdentityGuard);

class SkillResolver {
  async check({ actor }) {
    return actor.userId === alice ? "allow" : "deny";
  }
}
Injectable()(SkillResolver);

class SecuredController {
  read() {
    return { visible: true };
  }
}
const descriptor = Object.getOwnPropertyDescriptor(
  SecuredController.prototype,
  "read",
);
Controller("secured")(SecuredController);
Get(":skillId")(SecuredController.prototype, "read", descriptor);
RequirePermissions("sharing-skill:update:self")(
  SecuredController.prototype,
  "read",
  descriptor,
);
CheckResource({
  resolver: SkillResolver,
  idParam: "skillId",
  operation: "sharing-skill:update:self",
})(SecuredController.prototype, "read", descriptor);
UseGuards(FixtureIdentityGuard, PermissionGuard, ResourceAccessGuard)(
  SecuredController.prototype,
  "read",
  descriptor,
);

class TestModule {}
Module({
  controllers: [SecuredController],
  providers: [
    FixtureIdentityGuard,
    PermissionGuard,
    ResourceAccessGuard,
    AccessControlService,
    SkillResolver,
    { provide: AUTHORIZATION_READER, useValue: reader },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})(TestModule);

test("HTTP guard chain rejects missing permission and wrong owner with the API error envelope", async () => {
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/secured`;
  const request = (token, id = skillId) =>
    fetch(`${base}/${id}`, {
      headers: token ? { authorization: `Bearer fixture-${token}` } : {},
    });
  try {
    const missing = await request();
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), {
      success: false,
      statusCode: 401,
      message: "Unauthorized",
    });

    const outsider = await request("bob");
    assert.equal(outsider.status, 404);
    assert.deepEqual(await outsider.json(), {
      success: false,
      statusCode: 404,
      message: "Not Found",
    });

    const owner = await request("alice");
    assert.equal(owner.status, 200);
    assert.deepEqual(await owner.json(), { visible: true });

    users.get(alice).permissions.clear();
    const revoked = await request("alice");
    assert.equal(revoked.status, 403);
    assert.deepEqual(await revoked.json(), {
      success: false,
      statusCode: 403,
      message: "Forbidden",
    });

    const malformed = await request("bob", "not-an-id");
    assert.equal(malformed.status, 400);
  } finally {
    users.get(alice).permissions.add("sharing-skill:update:self");
    await app.close();
  }
});
