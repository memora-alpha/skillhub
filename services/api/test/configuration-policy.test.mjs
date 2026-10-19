import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIGURATION_DEFINITIONS,
  isConfigurationKey,
  parseConfigurationValue,
  requireMutableConfigurationKey,
} from "../dist/modules/system-configuration/domain/configuration.catalog.js";

test("approved defaults and mutability are explicit", () => {
  assert.equal(
    CONFIGURATION_DEFINITIONS["learningPath.minCreditPerUser"].defaultValue,
    20,
  );
  assert.equal(
    CONFIGURATION_DEFINITIONS["credit.topUpVndPerCredit"].defaultValue,
    1000,
  );
  assert.deepEqual(
    CONFIGURATION_DEFINITIONS["credit.pathSettlementBps"].defaultValue,
    { returned: 9600, fee: 400 },
  );
  assert.deepEqual(
    CONFIGURATION_DEFINITIONS["session.durationMinutes"].defaultValue,
    { min: 60, max: 180 },
  );
  assert.equal(
    CONFIGURATION_DEFINITIONS["schedule.rescheduleCutoffMinutes"].defaultValue,
    60,
  );
  assert.equal(
    CONFIGURATION_DEFINITIONS["storage.downloadTtlSeconds"].defaultValue,
    120,
  );
  assert.equal(
    CONFIGURATION_DEFINITIONS["storage.evidenceMaxBytes"].defaultValue,
    10_000_000,
  );
  assert.deepEqual(Object.keys(CONFIGURATION_DEFINITIONS).sort(), [
    "credit.pathSettlementBps",
    "credit.topUpVndPerCredit",
    "learningPath.minCreditPerUser",
    "learningRequest.moderationRuleSet",
    "livekit.joinWindow",
    "schedule.rescheduleCutoffMinutes",
    "session.durationMinutes",
    "storage.downloadTtlSeconds",
    "storage.evidenceMaxBytes",
  ]);
});

test("rejects unknown and secret-like keys", () => {
  for (const key of [
    "storage.secretAccessKey",
    "oauth.clientSecret",
    "__proto__",
    "unknown",
  ]) {
    assert.equal(isConfigurationKey(key), false);
    assert.throws(() => parseConfigurationValue(key, "secret"));
  }
});

test("strict values reject malformed objects and invalid split", () => {
  assert.deepEqual(
    parseConfigurationValue("credit.pathSettlementBps", {
      returned: 9600,
      fee: 400,
    }),
    { returned: 9600, fee: 400 },
  );
  for (const value of [
    { returned: 9600, fee: 500 },
    { returned: 9600, fee: 400, password: "secret" },
    { returned: -1, fee: 10_001 },
  ]) {
    assert.throws(() =>
      parseConfigurationValue("credit.pathSettlementBps", value),
    );
  }
  assert.throws(() =>
    parseConfigurationValue("session.durationMinutes", { min: 180, max: 60 }),
  );
  assert.throws(() =>
    parseConfigurationValue("storage.evidenceMaxBytes", null),
  );
  assert.throws(() => parseConfigurationValue("storage.evidenceMaxBytes", 0));
  assert.throws(() =>
    parseConfigurationValue("storage.evidenceMaxBytes", 10.5),
  );
});

test("only mutable keys enter runtime update", () => {
  assert.equal(
    requireMutableConfigurationKey("storage.downloadTtlSeconds"),
    "storage.downloadTtlSeconds",
  );
  assert.equal(
    requireMutableConfigurationKey("storage.evidenceMaxBytes"),
    "storage.evidenceMaxBytes",
  );
  assert.equal(
    requireMutableConfigurationKey("learningRequest.moderationRuleSet"),
    "learningRequest.moderationRuleSet",
  );
  assert.throws(() =>
    requireMutableConfigurationKey("credit.topUpVndPerCredit"),
  );
});
