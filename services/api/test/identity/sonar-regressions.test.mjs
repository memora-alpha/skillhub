import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpException, ValidationPipe } from "@nestjs/common";
import { EmptyDto } from "../../dist/modules/auth/presentation/http/auth.dto.js";
import { ListUsersUseCase } from "../../dist/modules/users/application/use-cases/list-users.use-case.js";
import {
  IdentityThrottle,
  SharedRequestGuard,
} from "../../dist/shared/auth/identity-throttle.js";

test("user list masks normal and quoted emails without exposing the local part", async () => {
  const emails = [
    "alice@example.com",
    "a@example.com",
    '"a@b"@example.com',
    "a".repeat(242) + "@example.com",
  ];
  const rows = emails.map((normalizedEmail, index) => ({
    id: String(index),
    normalizedEmail,
    accountStatus: "ACTIVE",
    profile: null,
    roles: [],
    createdAt: new Date(0),
  }));
  const principal = { permissions: ["users.read"], roles: ["ADMIN"] };
  const useCase = new ListUsersUseCase(
    {},
    { list: async () => rows },
    { assertLive: async () => principal },
  );
  const result = await useCase.execute(principal, {});
  assert.deepEqual(
    result.items.map((item) => item.maskedEmail),
    [
      "a***@example.com",
      "a***@example.com",
      '"***@example.com',
      "a***@example.com",
    ],
  );
});

test("empty body DTO rejects injected fields while allowing an empty logout-all body", async () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  await pipe.transform({}, { type: "body", metatype: EmptyDto });
  await assert.rejects(
    pipe.transform(
      { userId: "another-user" },
      { type: "body", metatype: EmptyDto },
    ),
    (error) => error.getStatus() === 400,
  );
});

test("request guard exempts health and preserves throttle 429/503 exceptions", async () => {
  class HealthController {}
  class UsersController {}
  let calls = 0;
  const context = (controller) => ({
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ ip: "127.0.0.1" }) }),
  });
  const guard = new SharedRequestGuard({
    request: async () => {
      calls++;
    },
  });
  assert.equal(await guard.canActivate(context(HealthController)), true);
  assert.equal(calls, 0);
  assert.equal(await guard.canActivate(context(UsersController)), true);
  assert.equal(calls, 1);
  for (const status of [429, 503]) {
    const denied = new SharedRequestGuard({
      request: async () => {
        throw new HttpException("denied", status);
      },
    });
    await assert.rejects(
      denied.canActivate(context(UsersController)),
      (error) => error.getStatus() === status,
    );
  }
});

test("dimension throttle stops before advancing later counters and fails closed on Redis errors", async () => {
  const config = {
    jwtKey: "fixture-key",
    emailLimit: 1,
    ipLimit: 1,
    deviceLimit: 1,
    throttleWindowMs: 1000,
  };
  let calls = 0;
  const throttle = new IdentityThrottle(
    {
      eval: async () => {
        calls++;
        return [2, 1000];
      },
    },
    config,
  );
  await assert.rejects(
    throttle.check("login", "alice@example.com", "127.0.0.1", "device"),
    (error) => error.getStatus() === 429,
  );
  assert.equal(calls, 1);
  const unavailable = new IdentityThrottle(
    {
      eval: async () => {
        throw new Error("unavailable");
      },
    },
    config,
  );
  await assert.rejects(
    unavailable.check("login", "alice@example.com", "127.0.0.1", "device"),
    (error) => error.getStatus() === 503,
  );
});
