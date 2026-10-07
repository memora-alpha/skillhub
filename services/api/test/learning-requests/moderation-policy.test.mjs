import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateModeration,
  normalizeRequestText,
} from "../../dist/modules/learning-requests/domain/moderation.policy.js";

const snapshot = (rules, version = 7) => ({ ruleSet: { rules }, version });
const content = (overrides = {}) => ({
  title: "Practice Vietnamese",
  description: "A friendly language exchange.",
  learningGoal: "Speak more confidently.",
  tags: ["Conversation"],
  ...overrides,
});

test("normalization applies NFKC, case and whitespace while preserving Vietnamese accents", () => {
  assert.equal(
    normalizeRequestText("  Ｔiếng   VIỆT\n tốt  "),
    "tiếng việt tốt",
  );
  assert.notEqual(normalizeRequestText("ma"), normalizeRequestText("má"));
});

test("filter scans title, description, goal and canonical tag labels", () => {
  const rules = [{ category: "TEST", pattern: "unsafe phrase" }];
  for (const value of [
    content({ title: "unsafe phrase" }),
    content({ description: "unsafe phrase" }),
    content({ learningGoal: "unsafe phrase" }),
    content({ tags: ["unsafe phrase"] }),
  ]) {
    assert.deepEqual(evaluateModeration(value, snapshot(rules)), {
      flagged: true,
      categories: ["TEST"],
      ruleSetVersion: 7,
    });
  }
});

test("bounded wildcard matches ordered literal segments without accepting regex", () => {
  const ruleSet = snapshot([{ category: "TEST", pattern: "bad*phrase" }]);
  assert.equal(
    evaluateModeration(content({ title: "bad words phrase" }), ruleSet).flagged,
    true,
  );
  assert.equal(
    evaluateModeration(content({ title: "bad phrase" }), ruleSet).flagged,
    true,
  );
  assert.equal(
    evaluateModeration(content({ title: "baad phrase" }), ruleSet).flagged,
    false,
  );
});

test("wildcard scans bounded request text without regex backtracking", () => {
  const prefix = "a".repeat(59);
  const suffix = "b".repeat(60);
  const start = performance.now();
  const result = evaluateModeration(
    content({ title: "a".repeat(3000) }),
    snapshot([{ category: "TEST", pattern: `${prefix}*${suffix}` }]),
  );
  assert.equal(result.flagged, false);
  assert.ok(performance.now() - start < 1000);
});

test("missing, empty and malformed rules fail closed as unavailable", () => {
  for (const ruleSet of [
    undefined,
    snapshot([]),
    snapshot([{ category: "TEST", pattern: "*" }]),
  ]) {
    assert.throws(
      () => evaluateModeration(content(), ruleSet),
      (error) => error?.getStatus?.() === 503,
    );
  }
});
