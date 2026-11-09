import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEnvironment } from "../dist/configs/environment.js";

const environment = {
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://localhost/qa",
  MONGODB_URI: "mongodb://localhost/qa",
  REDIS_URL: "redis://localhost",
};

test("QA adjustments default off and require an explicit test tier", () => {
  assert.equal(
    validateEnvironment(environment).QA_ADMIN_ADJUSTMENTS_ENABLED,
    false,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...environment,
        QA_ADMIN_ADJUSTMENTS_ENABLED: "true",
      }),
    /QA_ADMIN_ADJUSTMENTS_ENABLED/,
  );
  assert.equal(
    validateEnvironment({
      ...environment,
      APP_DEPLOYMENT_TIER: "staging",
      QA_ADMIN_ADJUSTMENTS_ENABLED: "true",
    }).QA_ADMIN_ADJUSTMENTS_ENABLED,
    true,
  );
});

test("a TLS-configured staging deployment can enable QA in production runtime mode", () => {
  const config = validateEnvironment({
    NODE_ENV: "production",
    APP_DEPLOYMENT_TIER: "staging",
    QA_ADMIN_ADJUSTMENTS_ENABLED: "true",
    CORS_ORIGIN: "https://qa.example.test",
    DATABASE_URL: "postgresql://db.example.test/qa?sslmode=verify-full",
    MONGODB_URI: "mongodb://mongo.example.test/qa?tls=true",
    REDIS_URL: "rediss://redis.example.test",
  });
  assert.equal(config.QA_ADMIN_ADJUSTMENTS_ENABLED, true);
});
