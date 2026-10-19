import assert from "node:assert/strict";
import { test } from "node:test";
import { liveKitConfiguration } from "../../dist/modules/learning-sessions/livekit.service.js";
import {
  CONFIGURATION_DEFINITIONS,
  parseConfigurationValue,
} from "../../dist/modules/system-configuration/domain/configuration.catalog.js";

const valid = {
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-secret",
};
test("provider is optional but partial or unsafe configuration fails without secrets", () => {
  assert.deepEqual(liveKitConfiguration({}), { enabled: false });
  assert.equal(liveKitConfiguration(valid).enabled, true);
  for (const value of [
    { LIVEKIT_API_SECRET: "private-value" },
    { ...valid, LIVEKIT_URL: "wss://user:private-value@example.com" },
    { ...valid, LIVEKIT_URL: "ws://example.com" },
    { ...valid, LIVEKIT_URL: "wss://example.com?secret=private-value" },
    { ...valid, NODE_ENV: "production", LIVEKIT_URL: "ws://localhost:7880" },
  ]) {
    assert.throws(
      () => liveKitConfiguration(value),
      (error) =>
        error.message.startsWith("Invalid LiveKit configuration:") &&
        !error.message.includes("private-value"),
    );
  }
  assert.equal(
    liveKitConfiguration({ ...valid, LIVEKIT_URL: "ws://127.0.0.1:7880" })
      .enabled,
    true,
  );
});

test("join policy is mutable, strict and has no production default", () => {
  const definition = CONFIGURATION_DEFINITIONS["livekit.joinWindow"];
  assert.equal(definition.mutable, true);
  assert.equal(Object.hasOwn(definition, "defaultValue"), false);
  assert.deepEqual(
    parseConfigurationValue("livekit.joinWindow", {
      earlyMinutes: 0,
      lateMinutes: 10,
    }),
    { earlyMinutes: 0, lateMinutes: 10 },
  );
  for (const value of [
    null,
    {},
    { earlyMinutes: -1, lateMinutes: 0 },
    { earlyMinutes: 0, lateMinutes: 0.1 },
    { earlyMinutes: 0, lateMinutes: 0, secret: "bad" },
  ]) {
    assert.throws(() => parseConfigurationValue("livekit.joinWindow", value));
  }
});
