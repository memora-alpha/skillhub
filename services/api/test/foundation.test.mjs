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

test("environment validation preserves module configuration alongside storage settings", () => {
  const config = validateEnvironment({
    ...valid,
    IDENTITY_JWT_KEY: "value",
    IDENTITY_JWT_ISSUER: "skillhub-test",
    STORAGE_ENABLED: "false",
  });
  assert.equal(config.IDENTITY_JWT_KEY, "value");
  assert.equal(config.IDENTITY_JWT_ISSUER, "skillhub-test");
  assert.equal(config.STORAGE_ENABLED, false);
});

function invokeFilter(
  error,
  request = { headers: {}, method: "GET", url: "/test" },
) {
  const result = {};
  const logs = [];
  const response = {
    status(code) {
      result.code = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  const filter = new HttpExceptionFilter();
  filter.logger.error = (entry) => logs.push(entry);
  filter.catch(error, {
    getType: () => "http",
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  });
  result.logs = logs;
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
  assert.deepEqual(result.logs, []);
});

test("server errors retain correlation and missing-column diagnostics without request or exception secrets", () => {
  const error = new Error("SQL with private-description and private-password");
  error.code = "P2022";
  error.meta = {
    driverAdapterError: {
      cause: {
        originalCode: "42703",
        originalMessage:
          "column learning_requests.teaching_overview does not exist",
        query: "private-description",
      },
    },
  };
  const result = invokeFilter(error, {
    headers: {
      authorization: "Bearer private-token",
      "x-correlation-id": "123e4567-e89b-42d3-a456-426614174000",
    },
    method: "POST",
    url: "/api/v1/learning-requests?token=private-token",
    body: { description: "private-description" },
  });
  assert.equal(result.code, 500);
  assert.equal(result.logs.length, 1);
  const log = result.logs[0];
  assert.equal(log.event, "http.server_error");
  assert.equal(log.correlationId, "123e4567-e89b-42d3-a456-426614174000");
  assert.match(log.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(log.path, "/api/v1/learning-requests");
  assert.equal(log.errorCode, "P2022");
  assert.equal(log.databaseCode, "42703");
  assert.equal(log.missingColumn, "learning_requests.teaching_overview");
  assert.doesNotMatch(JSON.stringify(result), /private-|SQL with/);
  assert.equal(result.body.message, "Internal server error");
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
