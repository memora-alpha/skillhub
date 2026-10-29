import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyLifecycle,
  parseArguments,
} from "../../scripts/reconcile-learning-requests.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const base = {
  requestId: id,
  version: 2,
  status: "NEGOTIATING",
  sourceValid: true,
  paths: [],
};
const committed = { pathId, committed: true, consistent: true, settled: false };

test("preview identifies only unambiguous MATCHED/CLOSED repairs and preserves transition order", () => {
  const matched = classifyLifecycle({ ...base, paths: [committed] });
  assert.equal(matched.classification, "NEEDS_REPAIR");
  assert.deepEqual(matched.proposedTransitions, ["MATCHED"]);
  assert.equal(matched.expectedRequestVersion, 2);
  assert.equal(matched.candidatePathId, pathId);
  const closed = classifyLifecycle({
    ...base,
    paths: [{ ...committed, settled: true }],
  });
  assert.deepEqual(closed.proposedTransitions, ["MATCHED", "CLOSED"]);
  assert.deepEqual(
    classifyLifecycle({
      ...base,
      status: "MATCHED",
      paths: [{ ...committed, settled: true }],
    }).proposedTransitions,
    ["CLOSED"],
  );
});

test("inconsistent evidence has precedence over NO_CHANGE and never chooses a winner", () => {
  for (const snapshot of [
    { ...base, sourceValid: false },
    { ...base, status: "MATCHED" },
    { ...base, status: "CLOSED" },
    { ...base, paths: [{ ...committed, consistent: false }] },
    { ...base, paths: [{ ...committed, committed: false, consistent: false }] },
    { ...base, status: "CANCELLED", paths: [committed] },
    { ...base, paths: [committed, { ...committed, pathId: id }] },
    { ...base, status: "CLOSED", paths: [committed] },
  ]) {
    const report = classifyLifecycle(snapshot);
    assert.equal(report.classification, "MANUAL_REVIEW");
    assert.deepEqual(report.proposedTransitions, []);
    assert.equal(report.candidatePathId, null);
  }
});

test("clean pre-match, cancelled and already reconciled records need no changes", () => {
  for (const snapshot of [
    base,
    { ...base, status: "CANCELLED" },
    { ...base, status: "MATCHED", paths: [committed] },
    { ...base, status: "CLOSED", paths: [{ ...committed, settled: true }] },
  ]) {
    assert.equal(classifyLifecycle(snapshot).classification, "NO_CHANGE");
  }
});

test("CLI validates flags/UUID/limit and requires its explicit database before connecting", () => {
  const env = {
    LEARNING_REQUEST_RECONCILIATION_DATABASE_URL: "postgres://example/test",
  };
  assert.deepEqual(parseArguments(["--limit", "10", "--after", id], env), {
    limit: 10,
    after: id,
    connectionString: env.LEARNING_REQUEST_RECONCILIATION_DATABASE_URL,
  });
  for (const args of [
    ["--apply"],
    ["--limit", "0"],
    ["--limit", "1001"],
    ["--limit", "1.5"],
    ["--after", "bad"],
    ["--limit"],
    ["--limit", "5", "--limit", "6"],
  ])
    assert.throws(() => parseArguments(args, env));
  assert.throws(
    () => parseArguments([], { DATABASE_URL: "postgres://must-not-use/app" }),
    /LEARNING_REQUEST_RECONCILIATION_DATABASE_URL/,
  );
});
