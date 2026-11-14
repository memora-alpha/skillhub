import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { IdentityThrottle } from "../../dist/shared/auth/identity-throttle.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";

const token = (sid) =>
  [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(JSON.stringify({ sid })).toString("base64url"),
    "signature",
  ].join(".");

const request = (sid) => ({
  method: "GET",
  originalUrl: "/api/v1/materials",
  url: "/api/v1/materials",
  ip: "203.0.113.10",
  headers: {
    authorization: `Bearer ${token(sid)}`,
    "x-device-id": `device-${sid}`,
  },
});

test("principal/session counters isolate accounts sharing one network", async () => {
  const counters = new Map();
  const redis = {
    async eval(_script, _keys, key) {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return [count, 60_000];
    },
  };
  const throttle = new IdentityThrottle(redis, {
    requestLimit: 1,
    throttleWindowMs: 60_000,
    deviceHmacKey: "d".repeat(32),
    jwtKey: "j".repeat(32),
  });
  await throttle.request(request("account-a"));
  await assert.rejects(
    throttle.request(request("account-a")),
    (error) => error instanceof HttpException && error.getStatus() === 429,
  );
  await throttle.request(request("account-b"));
});

test("Redis failure is fail-closed", async () => {
  const throttle = new IdentityThrottle(
    {
      async eval() {
        throw new Error("secret provider detail");
      },
    },
    {
      requestLimit: 10,
      throttleWindowMs: 60_000,
      deviceHmacKey: "d".repeat(32),
      jwtKey: "j".repeat(32),
    },
  );
  await assert.rejects(
    throttle.request(request("account-a")),
    (error) => error instanceof HttpException && error.getStatus() === 503,
  );
});

test("429 filter emits retry metadata without echoing device identity", () => {
  const headers = new Map();
  let body;
  const response = {
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
    status() {
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  const host = {
    getType: () => "http",
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: "GET", url: "/api/v1/materials" }),
    }),
  };
  new HttpExceptionFilter().catch(
    new HttpException(
      {
        message: "RATE_LIMITED",
        rateLimit: { limit: 10, remaining: 0, resetSeconds: 30 },
      },
      429,
    ),
    host,
  );
  assert.equal(headers.get("retry-after"), "30");
  assert.equal(headers.get("ratelimit-limit"), "10");
  assert.equal(headers.get("ratelimit-remaining"), "0");
  assert.equal(JSON.stringify(body).includes("device"), false);
});
