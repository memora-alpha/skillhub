import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Controller, Get, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { validateEnvironment } from "../dist/configs/environment.js";

const base = {
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  MONGODB_URI: "mongodb://localhost:27017/db",
  REDIS_URL: "redis://localhost:6379/0",
};
const portal = "https://portal-skillhub.memora.cam";
const other = "https://other.example.com";
const production = {
  ...base,
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@db.example:5432/db?sslmode=verify-full",
  MONGODB_URI: "mongodb+srv://user:pass@mongo.example/db?tls=true",
  REDIS_URL: "rediss://redis.example:6380/0",
};

test("CORS accepts a single origin and trims comma-separated origins", () => {
  assert.deepEqual(validateEnvironment(base).CORS_ORIGIN, [base.CORS_ORIGIN]);
  assert.deepEqual(
    validateEnvironment({
      ...base,
      CORS_ORIGIN: ` ${portal}, \t${other}/ `,
    }).CORS_ORIGIN,
    [portal, other],
  );
});

test("CORS rejects empty entries, invalid URLs and values that are not origins", () => {
  for (const value of [
    "",
    " ",
    `${portal},`,
    `,${portal}`,
    `${portal}, ,${other}`,
    `${portal},invalid`,
    "*",
    "https://*.example.com",
    "ftp://example.com",
    `${portal}/page`,
    `${portal}?query=value`,
    `${portal}#fragment`,
    "https://user:private-password@example.com",
  ]) {
    assert.throws(
      () => validateEnvironment({ ...base, CORS_ORIGIN: value }),
      (error) => {
        assert.match(error.message, /CORS_ORIGIN/);
        assert.doesNotMatch(error.message, /private-password/);
        return true;
      },
      value,
    );
  }
});

test("production requires HTTPS for every CORS origin", () => {
  assert.deepEqual(
    validateEnvironment({
      ...production,
      CORS_ORIGIN: `${portal}, ${other}`,
    }).CORS_ORIGIN,
    [portal, other],
  );
  for (const value of [
    base.CORS_ORIGIN,
    `${portal},${base.CORS_ORIGIN}`,
    `${base.CORS_ORIGIN},${portal}`,
  ]) {
    assert.throws(
      () => validateEnvironment({ ...production, CORS_ORIGIN: value }),
      /CORS_ORIGIN/,
    );
  }
});

class ProbeController {
  get() {
    return { ok: true };
  }
}
Controller("probe")(ProbeController);
Get()(
  ProbeController.prototype,
  "get",
  Object.getOwnPropertyDescriptor(ProbeController.prototype, "get"),
);
class TestModule {}
Module({ controllers: [ProbeController] })(TestModule);

test("HTTP CORS permits each configured origin and omits permission for others", async (t) => {
  const config = new ConfigService(
    validateEnvironment({ ...base, CORS_ORIGIN: `${portal}, ${other}` }),
  );
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  app.enableCors({ origin: config.getOrThrow("CORS_ORIGIN") });
  await app.listen(0, "127.0.0.1");
  const address = `${await app.getUrl()}/probe`;
  for (const origin of [portal, other, "https://unlisted.example.com"]) {
    const expected = origin === portal || origin === other ? origin : null;
    const response = await fetch(address, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), expected);
    await response.body.cancel();
    const preflight = await fetch(address, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      expected,
    );
    if (expected) {
      assert.match(
        preflight.headers.get("access-control-allow-methods"),
        /POST/,
      );
      assert.equal(
        preflight.headers.get("access-control-allow-headers"),
        "authorization,content-type",
      );
    }
  }
  const response = await fetch(address);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  await response.body.cancel();
});
