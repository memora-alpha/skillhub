import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEnvironment } from "../dist/configs/environment.js";

const base = {
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  MONGODB_URI: "mongodb://localhost:27017/db",
  REDIS_URL: "redis://localhost:6379/0",
};

test("rate limit is positive and validated", () => {
  const values = validateEnvironment(base);
  assert.equal(values.API_RATE_LIMIT_LIMIT, 120);
  assert.equal(values.API_RATE_LIMIT_TTL_MS, 60_000);
  assert.equal(
    validateEnvironment({ ...base, API_RATE_LIMIT_LIMIT: "60" })
      .API_RATE_LIMIT_LIMIT,
    60,
  );
  assert.throws(
    () => validateEnvironment({ ...base, API_RATE_LIMIT_LIMIT: "0" }),
    /API_RATE_LIMIT_LIMIT/,
  );
  assert.throws(
    () => validateEnvironment({ ...base, API_RATE_LIMIT_TTL_MS: "-1" }),
    /API_RATE_LIMIT_TTL_MS/,
  );
});

test("production database and redis URLs require TLS verification settings", () => {
  assert.throws(
    () => validateEnvironment({ ...base, NODE_ENV: "production" }),
    /DATABASE_URL|MONGODB_URI|REDIS_URL/,
  );
  const production = {
    ...base,
    NODE_ENV: "production",
    CORS_ORIGIN: "https://app.skillhub.example",
    DATABASE_URL:
      "postgresql://user:pass@db.example:5432/db?sslmode=verify-full",
    MONGODB_URI: "mongodb+srv://user:pass@mongo.example/db?tls=true",
    REDIS_URL: "rediss://redis.example:6380/0",
  };
  assert.equal(validateEnvironment(production).NODE_ENV, "production");
  assert.throws(
    () => validateEnvironment({ ...production, REDIS_URL: base.REDIS_URL }),
    /REDIS_URL/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...production,
        DATABASE_URL: `${production.DATABASE_URL}&sslmode=disable`,
      }),
    /DATABASE_URL/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...production,
        MONGODB_URI: `${production.MONGODB_URI}&tlsAllowInvalidCertificates=true`,
      }),
    /MONGODB_URI/,
  );
});

test("enabled storage requires provider values, disabled storage does not", () => {
  assert.equal(validateEnvironment(base).STORAGE_ENABLED, false);
  assert.throws(
    () => validateEnvironment({ ...base, STORAGE_ENABLED: "true" }),
    /STORAGE_/,
  );
});
