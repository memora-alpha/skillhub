import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Body,
  Controller,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { APP_FILTER, NestFactory } from "@nestjs/core";
import { AUTHORIZATION_READER } from "../dist/shared/authorization/authorization.types.js";
import { AccessControlService } from "../dist/shared/authorization/access-control.service.js";
import { RequirePermissions } from "../dist/shared/authorization/access.decorators.js";
import { PermissionGuard } from "../dist/shared/authorization/permission.guard.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";
import { getOrCreateRequestContext } from "../dist/shared/http/request-context.js";
import { AuditWriter } from "../dist/modules/audit/application/audit-writer.js";
import { auditActorFromActor } from "../dist/modules/audit/application/audit.types.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/audit.repository.js";

// Fixture consumer only: no production credit route or auth exists yet (SH-010/012).
const admin = "11111111-1111-4111-8111-111111111111";
const staff = "22222222-2222-4222-8222-222222222222";
const walletId = "33333333-3333-4333-8333-333333333333";
const actorOf = (userId, role, permissions) => ({
  userId,
  accountStatus: "ACTIVE",
  roles: [role],
  permissions: new Set(permissions),
  blockedPermissions: new Set(),
});
const users = new Map([
  [admin, actorOf(admin, "ADMIN", ["credit:adjust"])],
  [staff, actorOf(staff, "STAFF", [])],
]);

const writer = new AuditWriter(new AuditRepository());
const state = { balance: 100, mutations: 0, audits: [] };
const tx = {
  auditLog: { create: async ({ data }) => (state.audits.push(data), {}) },
};

class FixtureIdentityGuard {
  canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const userId = {
      "Bearer fixture-admin": admin,
      "Bearer fixture-staff": staff,
    }[request.headers.authorization];
    if (userId)
      request.authenticatedIdentity = { userId, sessionId: "fixture-only" };
    return true;
  }
}
Injectable()(FixtureIdentityGuard);

class AdjustController {
  // Convention under test: validate -> mutate -> append, actor only from request.actor.
  async adjust(request, body) {
    const after = state.balance + body.amount;
    const input = writer.validate({
      actor: auditActorFromActor(request.actor),
      action: "CREDIT_ADJUST",
      target: { type: "CREDIT_WALLET", id: walletId },
      before: { balanceBefore: String(state.balance) },
      after: { amount: String(body.amount), balanceAfter: String(after) },
      reason: body.reason,
      context: getOrCreateRequestContext(request),
    });
    state.balance = after;
    state.mutations++;
    return writer.append(tx, input);
  }
}
const descriptor = Object.getOwnPropertyDescriptor(
  AdjustController.prototype,
  "adjust",
);
Controller("wallets")(AdjustController);
Post("adjust")(AdjustController.prototype, "adjust", descriptor);
Req()(AdjustController.prototype, "adjust", 0);
Body()(AdjustController.prototype, "adjust", 1);
RequirePermissions("credit:adjust")(
  AdjustController.prototype,
  "adjust",
  descriptor,
);
UseGuards(FixtureIdentityGuard, PermissionGuard)(
  AdjustController.prototype,
  "adjust",
  descriptor,
);

class TestModule {}
Module({
  controllers: [AdjustController],
  providers: [
    FixtureIdentityGuard,
    PermissionGuard,
    AccessControlService,
    {
      provide: AUTHORIZATION_READER,
      useValue: { loadActor: async (userId) => users.get(userId) ?? null },
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})(TestModule);

test("sensitive mutation needs permission and reason; audit actor comes from the verified Actor, not the body", async () => {
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  const url = `http://127.0.0.1:${app.getHttpServer().address().port}/wallets/adjust`;
  const post = (token, body) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer fixture-${token}`,
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post("staff", { amount: 5, reason: "Manual correction" })).status,
      403,
    );
    for (const reason of [undefined, "   "]) {
      const response = await post("admin", { amount: 5, reason });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: { statusCode: 400, message: "Invalid audit input" },
      });
    }
    assert.deepEqual(
      {
        balance: state.balance,
        mutations: state.mutations,
        audits: state.audits.length,
      },
      { balance: 100, mutations: 0, audits: 0 },
    );

    const spoofed = await post("admin", {
      amount: 5,
      reason: "  Manual correction  ",
      actorId: staff,
      role: "USER",
      actor: { kind: "SYSTEM", name: "spoofed" },
    });
    assert.equal(spoofed.status, 201);
    assert.equal(state.mutations, 1);
    const [audit] = state.audits;
    assert.equal(audit.actorKind, "HUMAN");
    assert.equal(audit.actorUserId, admin);
    assert.deepEqual(audit.actorRoles, ["ADMIN"]);
    assert.equal(audit.systemActor, null);
    assert.equal(audit.reason, "Manual correction");
    assert.deepEqual(audit.after, { amount: "5", balanceAfter: "105" });
    assert.match(audit.requestId, /^[0-9a-f-]{36}$/);
  } finally {
    await app.close();
  }
});
