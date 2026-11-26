import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "../../scripts/benchmark-chat-moderation.mjs";

test("benchmark reports measured percentiles and keeps timeouts visible", () => {
  const samples = Array.from({ length: 20 }, (_, index) => ({
    group: "image_under_1mb",
    durationMs: (index + 1) * 250,
    outcome: "success",
  }));
  const find = (rows, group) =>
    summarize(rows).find((row) => row.group === group);
  assert.deepEqual(find(samples, "image_under_1mb"), {
    group: "image_under_1mb",
    target: 5000,
    count: 20,
    p50: 2500,
    p95: 4750,
    p99: 5000,
    timeouts: 0,
    failures: 0,
    unsupported: 0,
    reached: true,
  });
  samples.push({
    group: "image_under_1mb",
    durationMs: 120000,
    outcome: "timeout",
  });
  assert.equal(find(samples, "image_under_1mb").reached, false);
  assert.equal(find(samples, "image_under_1mb").timeouts, 1);
  assert.equal(find(samples, "pdf_scan_20_to_50").reached, false);
});
