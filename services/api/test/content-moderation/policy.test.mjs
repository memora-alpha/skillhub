import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { validateEnvironment } from "../../dist/configs/environment.js";
import { ContentModerationService } from "../../dist/modules/content-moderation/application/content-moderation.service.js";
import { moderationFlags } from "../../dist/modules/content-moderation/domain/moderation-policy.js";

const env = {
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://localhost/db",
  MONGODB_URI: "mongodb://localhost/db",
  REDIS_URL: "redis://localhost/0",
};
const flags = Object.fromEntries(moderationFlags.map((name) => [name, false]));
const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/vi-cases.json", import.meta.url), "utf8"),
);

test("requires a provider key only for enabled modes and validates the surface map", () => {
  assert.doesNotThrow(() => validateEnvironment(env));
  assert.throws(
    () =>
      validateEnvironment({ ...env, CONTENT_MODERATION_MODES: "chat:enforce" }),
    /OPENAI_API_KEY/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...env,
        CONTENT_MODERATION_MODES: "chat:observe,chat:enforce",
      }),
    /CONTENT_MODERATION_MODES/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...env,
        CONTENT_MODERATION_MODES: "payment:enforce",
      }),
    /CONTENT_MODERATION_MODES/,
  );
});

test("classifies designated groups, routes other flagged content to review, and retries provider failures", async () => {
  let result;
  const service = new ContentModerationService(
    new ConfigService({ CONTENT_MODERATION_MODES: "chat:enforce" }),
    {
      classify: async () => {
        if (result instanceof Error) throw result;
        return result;
      },
    },
  );
  const classify = () =>
    service.evaluate({
      surface: "chat",
      text: "Tin nhắn",
      sourceVersion: "1",
      digest: "digest",
    });
  for (const [category, outcome] of [
    [undefined, "ALLOW"],
    ["violence", "BLOCK"],
    ["sexual", "BLOCK"],
    ["illicit", "REVIEW"],
  ]) {
    result = {
      id: "modr-test",
      model: "fixture",
      flagged: !!category,
      categories: { ...flags, ...(category && { [category]: true }) },
    };
    assert.equal((await classify()).outcome, outcome);
  }
  result = new Error("the provider must not disclose this");
  const unavailable = await classify();
  assert.equal(unavailable.outcome, "RETRY");
  assert.doesNotMatch(JSON.stringify(unavailable), /must not disclose/);
});

test("keeps observation separate from enforcement and skips disabled surfaces", async () => {
  let calls = 0;
  const service = new ContentModerationService(
    new ConfigService({ CONTENT_MODERATION_MODES: "chat:observe" }),
    {
      classify: async () => {
        calls++;
        return {
          id: "modr-test",
          model: "fixture",
          flagged: true,
          categories: { ...flags, violence: true },
        };
      },
    },
  );
  const input = { text: "Nội dung", sourceVersion: "1", digest: "digest" };
  assert.equal(
    (await service.evaluate({ ...input, surface: "review" })).outcome,
    "ALLOW",
  );
  assert.equal(calls, 0);
  const assessed = await service.evaluate({ ...input, surface: "chat" });
  assert.equal(assessed.outcome, "ALLOW");
  assert.equal(assessed.observedOutcome, "BLOCK");
  assert.equal(calls, 1);
});

test("Vietnamese evaluation dataset includes expected outcomes and unresolved policy cases", () => {
  assert.equal(new Set(fixtures.map(({ id }) => id)).size, fixtures.length);
  for (const outcome of [
    "ALLOW",
    "BLOCK",
    "REVIEW",
    "CASE_INTAKE",
    "POLICY_PENDING",
  ]) {
    assert.ok(
      fixtures.some(({ expected }) => expected === outcome),
      outcome,
    );
  }
});

test("records classification metrics without logging the payload or its digest", async (t) => {
  const log = t.mock.method(Logger.prototype, "log", () => {});
  const service = new ContentModerationService(
    new ConfigService({ CONTENT_MODERATION_MODES: "chat:enforce" }),
    {
      classify: async () => {
        throw new Error("upstream-private-detail");
      },
    },
  );
  await service.evaluate({
    surface: "chat",
    sourceVersion: "private-source",
    digest: "private-digest",
    text: "private-text",
  });
  const data = log.mock.calls[0].arguments[0];
  assert.equal(data.outcome, "RETRY");
  assert.deepEqual(data.reasonCodes, ["PROVIDER_UNAVAILABLE"]);
  assert.doesNotMatch(JSON.stringify(data), /private/);
});
