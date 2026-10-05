import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEnvironment } from "../dist/configs/environment.js";
import { HttpExceptionFilter } from "../dist/shared/http/http-exception.filter.js";
import { BadRequestException } from "@nestjs/common";
import { HealthController } from "../dist/health.controller.js";

const valid = {
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:private-password@localhost:5433/skillhub",
  MONGODB_URI: "mongodb://localhost:27018/skillhub_chat",
  REDIS_URL: "redis://localhost:6380/0",
};

test("invalid config fails without exposing connection credentials", () => {
  assert.throws(
    () => validateEnvironment({ ...valid, PORT: "invalid" }),
    (error) => {
      assert.match(error.message, /PORT/);
      assert.doesNotMatch(error.message, /private-password/);
      return true;
    },
  );
  assert.throws(
    () =>
      validateEnvironment({ ...valid, DATABASE_URL: "https://wrong-provider" }),
    /DATABASE_URL/,
  );
  assert.equal(validateEnvironment(valid).PORT, 3001);
});

function invokeFilter(error) {
  const result = {};
  const response = {
    status(code) {
      result.code = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  new HttpExceptionFilter().catch(error, {
    getType: () => "http",
    switchToHttp: () => ({ getResponse: () => response }),
  });
  return result;
}

test("unexpected database errors do not expose secrets in HTTP responses", () => {
  const result = invokeFilter(new Error(valid.DATABASE_URL));
  assert.equal(result.code, 500);
  assert.deepEqual(result.body, {
    success: false,
    statusCode: 500,
    message: "Internal server error",
  });
  assert.doesNotMatch(JSON.stringify(result), /private-password/);
});

test("validation errors preserve field messages and HTTP status", () => {
  const result = invokeFilter(
    new BadRequestException(["email must be an email", "password is invalid"]),
  );
  assert.equal(result.code, 400);
  assert.deepEqual(result.body, {
    success: false,
    statusCode: 400,
    message: "email must be an email; password is invalid",
  });
});

test("readiness fails closed when document storage is unavailable", async () => {
  const controller = new HealthController(
    { $queryRaw: async () => [{ value: 1 }] },
    { ping: async () => "PONG" },
    { db: undefined },
  );
  await assert.rejects(
    controller.getReadiness(),
    (error) => error.getStatus() === 503,
  );
});

test("readiness fails closed when relational storage is unavailable", async () => {
  const controller = new HealthController(
    {
      $queryRaw: async () => {
        throw new Error("Database unavailable");
      },
    },
    { ping: async () => "PONG" },
    { db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) } },
  );
  await assert.rejects(
    controller.getReadiness(),
    (error) => error.getStatus() === 503,
  );
});
