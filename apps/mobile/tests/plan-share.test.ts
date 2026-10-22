import assert from "node:assert/strict";
import test from "node:test";
import {
  planShareMessage,
  readPlanShare,
} from "../src/features/learning-paths/utils/plan-share";
import { agreementPath } from "./fixtures/learning-agreement";

test("a shared plan is an ordinary message with bounded readable text and exact version", () => {
  const path = agreementPath(),
    plan = path.plans[0]!;
  const text = planShareMessage(
    path.id,
    plan.id,
    2,
    "  Học React\n qua dự án ",
    4,
  );
  assert.deepEqual(readPlanShare(text), {
    pathId: path.id,
    planId: plan.id,
    version: 2,
    title: "Học React qua dự án",
  });
  assert.ok(text.length < 2000);
  assert.equal(
    readPlanShare(planShareMessage(path.id, plan.id, 2, "a".repeat(1500), 100))
      ?.title.length,
    160,
  );
});
test("plain text, external links, malformed IDs and mismatched versions cannot become plan cards", () => {
  const path = agreementPath();
  const text = planShareMessage(path.id, path.plans[0]!.id, 2, "React", 1);
  for (const invalid of [
    "Chào bạn",
    text.replace("skillhub://", "https://evil.test/"),
    text.replace(path.id, "invalid"),
    text.replace("?version=2", "?version=3"),
    text + "\nextra",
    text.replace("?version=2", "?version=9007199254740993"),
  ])
    assert.equal(readPlanShare(invalid), null);
});
test("invalid resource identity cannot be emitted as a sharing message", () => {
  const path = agreementPath();
  assert.throws(() =>
    planShareMessage("invalid", path.plans[0]!.id, 2, "React", 1),
  );
  assert.throws(() =>
    planShareMessage(path.id, path.plans[0]!.id, 0, "React", 1),
  );
});
