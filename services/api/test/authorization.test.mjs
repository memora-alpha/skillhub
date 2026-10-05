import assert from "node:assert/strict";
import { test } from "node:test";
import { Reflector } from "@nestjs/core";
import { PERMISSION_CATALOG } from "../dist/shared/authorization/permission.catalog.js";
import { AccessControlService } from "../dist/shared/authorization/access-control.service.js";
import {
  Authenticated,
  Public,
  RequirePermissions,
} from "../dist/shared/authorization/access.decorators.js";
import { PermissionGuard } from "../dist/shared/authorization/permission.guard.js";
import { CheckResource } from "../dist/shared/authorization/check-resource.decorator.js";
import { ResourceAccessGuard } from "../dist/shared/authorization/resource-access.guard.js";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const resourceId = "33333333-3333-4333-8333-333333333333";
const identity = { userId: alice, sessionId: "session-a" };

function actor({
  userId = alice,
  roles = ["USER"],
  permissions = ["sharing-skill:update:self"],
  blockedPermissions = [],
  accountStatus = "ACTIVE",
} = {}) {
  return {
    userId,
    roles,
    permissions: new Set(permissions),
    blockedPermissions: new Set(blockedPermissions),
    accountStatus,
  };
}

function readerFor(getActor) {
  return new AccessControlService({ loadActor: async () => getActor() });
}

function route(decorators, request = {}) {
  class Controller {
    handle() {}
  }
  const handler = Controller.prototype.handle;
  for (const decorator of decorators) {
    decorator(
      Controller.prototype,
      "handle",
      Object.getOwnPropertyDescriptor(Controller.prototype, "handle"),
    );
  }
  return {
    handler,
    controller: Controller,
    request,
    context: {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
}

function status(error, code) {
  return error?.getStatus?.() === code;
}

test("permission catalog has separate actions and no Guest or wildcard grant", () => {
  const codes = PERMISSION_CATALOG.map(({ code }) => code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes("skill-verification:approve"));
  assert.ok(codes.includes("skill-verification:revoke"));
  assert.ok(codes.includes("learning-request:create"));
  assert.ok(codes.includes("proposal:create"));
  assert.ok(
    !codes.some((code) => code.includes("*") || code.startsWith("guest:")),
  );
});

test("current permissions are read for each request, so revocation takes effect", async () => {
  let current = actor({ permissions: ["skill-verification:approve"] });
  const access = readerFor(() => current);
  access.assertPermissions(await access.loadActor(identity, new Date()), [
    "skill-verification:approve",
  ]);
  current = actor({ permissions: [] });
  await assert.rejects(
    async () =>
      access.assertPermissions(await access.loadActor(identity, new Date()), [
        "skill-verification:approve",
      ]),
    (error) => status(error, 403),
  );
});

test("a reader cannot return another user's permissions for the authenticated identity", async () => {
  const access = readerFor(() =>
    actor({ userId: bob, roles: ["ADMIN"], permissions: ["credit:adjust"] }),
  );
  await assert.rejects(
    () => access.loadActor(identity, new Date()),
    (error) => status(error, 401),
  );
});

test("account status and action restrictions deny only the prohibited work", () => {
  const access = readerFor(() => null);
  for (const accountStatus of [
    "PENDING_VERIFICATION",
    "LOCKED",
    "SUSPENDED",
    "DEACTIVATED",
  ]) {
    assert.throws(
      () =>
        access.assertPermissions(actor({ accountStatus }), [
          "learning-request:create",
        ]),
      (error) => status(error, 403),
    );
  }
  const restricted = actor({
    permissions: [
      "learning-request:create",
      "proposal:create",
      "session:read:participant",
    ],
    blockedPermissions: ["learning-request:create", "proposal:create"],
  });
  assert.throws(
    () => access.assertPermissions(restricted, ["proposal:create"]),
    (error) => status(error, 403),
  );
  assert.doesNotThrow(() =>
    access.assertPermissions(restricted, ["session:read:participant"]),
  );
});

test("invalid identity and missing user fail without granting access", async () => {
  const access = readerFor(() => null);
  await assert.rejects(
    () => access.loadActor(identity, new Date()),
    (error) => status(error, 401),
  );
  await assert.rejects(
    () => access.loadActor({ userId: "", sessionId: "" }, new Date()),
    (error) => status(error, 401),
  );
});

test("permission guard requires a trusted identity and every declared action", async () => {
  const access = readerFor(() =>
    actor({ roles: ["ADMIN"], permissions: ["skill-verification:approve"] }),
  );
  const guard = new PermissionGuard(new Reflector(), access);
  const endpoint = route([
    RequirePermissions(
      "skill-verification:approve",
      "skill-verification:revoke",
    ),
  ]);
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 401),
  );
  endpoint.request.authenticatedIdentity = { ...identity, roles: ["ADMIN"] };
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 403),
  );
});

test("permission guard fails closed for missing or conflicting access metadata", async () => {
  const guard = new PermissionGuard(
    new Reflector(),
    readerFor(() => actor()),
  );
  const missing = route([]);
  await assert.rejects(
    () => guard.canActivate(missing.context),
    (error) => status(error, 500),
  );
  const conflict = route([
    Public(),
    RequirePermissions("sharing-skill:update:self"),
  ]);
  await assert.rejects(
    () => guard.canActivate(conflict.context),
    (error) => status(error, 500),
  );
  const publicRoute = route([Public()]);
  assert.equal(await guard.canActivate(publicRoute.context), true);
});

test("an empty action declaration cannot silently turn into authenticated-only access", async () => {
  const guard = new PermissionGuard(
    new Reflector(),
    readerFor(() => actor()),
  );
  const endpoint = route([Authenticated(), RequirePermissions()], {
    authenticatedIdentity: identity,
  });
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 500),
  );
});

test("controller permissions cannot be removed by a method", async () => {
  const access = readerFor(() =>
    actor({ permissions: ["skill-verification:approve"] }),
  );
  const guard = new PermissionGuard(new Reflector(), access);
  const endpoint = route([RequirePermissions("skill-verification:approve")], {
    authenticatedIdentity: identity,
  });
  RequirePermissions("skill-verification:revoke")(endpoint.controller);
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 403),
  );
});

test("resource guard checks stored ownership even for an ADMIN", async () => {
  class SkillResolver {}
  let seen;
  const resolver = {
    async check(input) {
      seen = input;
      return input.actor.userId === bob ? "allow" : "deny";
    },
  };
  const guard = new ResourceAccessGuard(new Reflector(), {
    get: () => resolver,
  });
  const endpoint = route(
    [
      RequirePermissions("sharing-skill:update:self"),
      CheckResource({
        resolver: SkillResolver,
        idParam: "skillId",
        operation: "sharing-skill:update:self",
      }),
    ],
    { actor: actor({ roles: ["ADMIN"] }), params: { skillId: resourceId } },
  );
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 404),
  );
  assert.equal(seen.actor.userId, alice);
  endpoint.request.actor = actor({ userId: bob });
  assert.equal(await guard.canActivate(endpoint.context), true);
});

test("resource guard rejects bad IDs and a resource policy without its permission", async () => {
  class SkillResolver {}
  const guard = new ResourceAccessGuard(new Reflector(), {
    get: () => ({ check: async () => "allow" }),
  });
  const endpoint = route(
    [
      RequirePermissions("sharing-skill:update:self"),
      CheckResource({
        resolver: SkillResolver,
        idParam: "skillId",
        operation: "sharing-skill:update:self",
      }),
    ],
    { actor: actor(), params: { skillId: "not-an-id" } },
  );
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 400),
  );
  const misconfigured = route(
    [
      Authenticated(),
      CheckResource({
        resolver: SkillResolver,
        idParam: "skillId",
        operation: "sharing-skill:update:self",
      }),
    ],
    { actor: actor(), params: { skillId: resourceId } },
  );
  await assert.rejects(
    () => guard.canActivate(misconfigured.context),
    (error) => status(error, 500),
  );
});

test("method resource policy cannot replace a controller ownership check", async () => {
  class OwnerResolver {}
  class MethodResolver {}
  const guard = new ResourceAccessGuard(new Reflector(), {
    get: () => ({ check: async () => "allow" }),
  });
  const endpoint = route(
    [
      RequirePermissions("sharing-skill:update:self"),
      CheckResource({
        resolver: MethodResolver,
        idParam: "skillId",
        operation: "sharing-skill:update:self",
      }),
    ],
    { actor: actor(), params: { skillId: resourceId } },
  );
  CheckResource({
    resolver: OwnerResolver,
    idParam: "skillId",
    operation: "sharing-skill:update:self",
  })(endpoint.controller);
  await assert.rejects(
    () => guard.canActivate(endpoint.context),
    (error) => status(error, 500),
  );
});
