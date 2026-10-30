import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Controller, Get, UseGuards, Logger } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  IdentityThrottle,
  SharedRequestGuard,
} from "../../dist/shared/auth/identity-throttle.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { RateLimitException } from "../../dist/shared/http/rate-limit.exception.js";
import { trustedProxySetting } from "../../dist/configs/proxy.config.js";
import { AuthController } from "../../dist/modules/auth/presentation/http/auth.controller.js";
import { EventConnectionsService } from "../../dist/modules/application-events/application/services/event-connections.service.js";

function fixture(overrides = {}) {
  const config = {
    jwtKey: "fixture-only-secret",
    throttleWindowMs: 60000,
    requestLimit: 100,
    emailLimit: 10,
    ipLimit: 100,
    deviceLimit: 1,
    userRequestLimit: 1,
    sessionRequestLimit: 10,
    ...overrides,
  };
  const counters = new Map();
  const redis = {
    eval: async (_script, _n, key) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return [n, 1250];
    },
  };
  return { throttle: new IdentityThrottle(redis, config), counters };
}

test("HTTP IP quota is isolated by API group; user quota spans sessions and IPs", async () => {
  const { throttle } = fixture({ requestLimit: 1 });
  await throttle.request("192.0.2.1", "conversations");
  await throttle.request("192.0.2.1", "users");
  await assert.rejects(
    throttle.request("192.0.2.1", "conversations"),
    (error) => {
      assert(error instanceof RateLimitException);
      assert.equal(error.details.dimension, "ip");
      assert.equal(error.details.retryAfterSeconds, 2);
      return true;
    },
  );
  await throttle.authenticated(
    { userId: "alice", sessionId: "a" },
    "conversations",
  );
  await throttle.authenticated(
    { userId: "bob", sessionId: "b" },
    "conversations",
  );
  await throttle.authenticated({ userId: "alice", sessionId: "a" }, "users");
  await assert.rejects(
    throttle.authenticated(
      { userId: "alice", sessionId: "another" },
      "conversations",
    ),
    (e) => e.details.dimension === "user",
  );
});

test("session limit is enforced independently of the user limit", async () => {
  const { throttle } = fixture({
    userRequestLimit: 10,
    sessionRequestLimit: 1,
  });
  await throttle.authenticated({ userId: "alice", sessionId: "one" }, "users");
  await assert.rejects(
    throttle.authenticated({ userId: "alice", sessionId: "one" }, "users"),
    (e) => e.details.dimension === "session",
  );
  await throttle.authenticated({ userId: "alice", sessionId: "two" }, "users");
});

test("same User-Agent cannot exhaust another account's client quota, even behind one IP", async () => {
  const { throttle, counters } = fixture();
  await throttle.check(
    "login",
    "alice@example.test",
    "192.0.2.1",
    "same-agent",
  );
  await throttle.check("login", "bob@example.test", "192.0.2.1", "same-agent");
  await assert.rejects(
    throttle.check("login", "alice@example.test", "192.0.2.1", "same-agent"),
    (e) => e.details.dimension === "client",
  );
  assert(
    [...counters.keys()].every((key) =>
      /^identity:limit:[a-f0-9]{64}$/.test(key),
    ),
  );
});

test("refresh controller passes each credential as the subject, preserving legacy response", async () => {
  const subjects = [];
  const { throttle } = fixture({ emailLimit: 1, deviceLimit: 10 });
  const controller = new AuthController(...Array(11).fill({}));
  controller.refreshToken = {
    execute: async () => ({ accessToken: "fixture" }),
  };
  controller.throttle = {
    check: async (purpose, subject, ip, agent) => {
      subjects.push(subject);
      return throttle.check(purpose, subject, ip, agent);
    },
  };
  const req = { ip: "192.0.2.1", headers: { "user-agent": "same-agent" } };
  assert.equal(
    (await controller.refresh({ refreshToken: "opaque-one" }, req)).success,
    true,
  );
  assert.equal(
    (await controller.refresh({ refreshToken: "opaque-two" }, req)).success,
    true,
  );
  assert.deepEqual(subjects, ["opaque-one", "opaque-two"]);
  await assert.rejects(
    controller.refresh({ refreshToken: "opaque-one" }, req),
    (e) => e.details.dimension === "subject",
  );
});

test("proxy config rejects blanket trust and malformed subnets", () => {
  assert.equal(trustedProxySetting(""), false);
  assert.deepEqual(trustedProxySetting("127.0.0.1, 2001:db8::/64"), [
    "127.0.0.1",
    "2001:db8::/64",
  ]);
  for (const value of [
    "true",
    "1",
    "uniquelocal",
    "0.0.0.0/0",
    "::/0",
    "192.0.2.1/33",
    "::1/129",
    "127.0.0.1,",
  ])
    assert.throws(() => trustedProxySetting(value));
});

test("real HTTP: authenticated scopes, trusted proxy, 429 retry header and safe logs", async () => {
  class InboxController {
    get() {
      return { ok: true };
    }
  }
  class UsersController {
    get() {
      return { ok: true };
    }
  }
  for (const [controller, path] of [
    [InboxController, "conversations"],
    [UsersController, "users"],
  ]) {
    Controller(path)(controller);
    UseGuards(IdentityGuard)(controller);
    Get()(
      controller.prototype,
      "get",
      Object.getOwnPropertyDescriptor(controller.prototype, "get"),
    );
  }
  const logs = [];
  const warn = Logger.prototype.warn;
  Logger.prototype.warn = function (data) {
    logs.push(data);
  };
  const { throttle } = fixture();
  const module = await Test.createTestingModule({
    controllers: [InboxController, UsersController],
    providers: [
      IdentityGuard,
      SharedRequestGuard,
      {
        provide: SessionsService,
        useValue: {
          principal: async (token) => {
            if (token === "bad") throw new Error("bad fixture token");
            return { userId: token, sessionId: `${token}-session` };
          },
        },
      },
      { provide: IdentityThrottle, useValue: throttle },
      { provide: APP_GUARD, useExisting: SharedRequestGuard },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.set("trust proxy", trustedProxySetting("127.0.0.1"));
  app.enableCors({
    origin: "https://client.example",
    exposedHeaders: ["Retry-After"],
  });
  try {
    await app.listen(0, "127.0.0.1");
    const root = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const call = (path, token) =>
      fetch(root + path, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Forwarded-For": "192.0.2.20",
          Origin: "https://client.example",
        },
      });
    assert.equal((await call("/conversations", "alice")).status, 200);
    assert.equal((await call("/conversations", "bob")).status, 200);
    assert.equal((await call("/users", "alice")).status, 200);
    const denied = await call(
      "/conversations?credential=never-log-me",
      "alice",
    );
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get("retry-after"), "2");
    assert.match(
      denied.headers.get("access-control-expose-headers"),
      /Retry-After/i,
    );
    const body = await denied.json();
    assert.equal(body.message, "RATE_LIMITED");
    assert.equal(body.details.scope, "conversations");
    assert.equal(body.details.dimension, "user");
    const log = logs.find((row) => row.event === "http.rate_limited");
    assert(log.requestId && log.correlationId);
    assert.equal(log.path, "/conversations");
    assert.equal(log.clientIpMatchesPeer, false);
    assert.equal(log.forwardedForPresent, true);
    assert(!JSON.stringify(log).includes("never-log-me"));
    assert(!JSON.stringify(log).includes("Bearer"));
    // Without trusted proxies, forged forwarded IPs cannot change the client address.
    app.set("trust proxy", false);
    await call("/users", "bob");
    await call("/users", "bob");
    assert.equal(
      logs.filter((row) => row.event === "http.rate_limited").at(-1)
        .clientIpMatchesPeer,
      true,
    );
  } finally {
    Logger.prototype.warn = warn;
    await app.close();
  }
});

test("SSE capacity 429 identifies dimension and uses the blocking lease expiry", async () => {
  const service = new EventConnectionsService(
    { eval: async () => [0, 2, 1700] },
    { values: { user: 3, session: 2, ip: 20, global: 1000, retryMs: 3000 } },
  );
  await assert.rejects(
    service.acquire("user", "session", "192.0.2.1"),
    (e) =>
      e.details.dimension === "session" && e.details.retryAfterSeconds === 2,
  );
});
