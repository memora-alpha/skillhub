import assert from "node:assert/strict";
import { test } from "node:test";
import { caseMessageTimeline } from "../src/features/reports/utils/case-message-timeline";

const row = (id: string, createdAt: string) => ({
  id,
  createdAt,
  senderId: "actor",
  text: id,
});
test("case messages render oldest to newest across descending pages and keep a newly sent message at the bottom", () => {
  const older = row("1", "2030-01-01T10:00:00Z"),
    newest = row("3", "2030-01-01T12:00:00Z"),
    middle = row("2", "2030-01-01T11:00:00Z");
  const input = [newest, middle, middle, older];
  assert.deepEqual(
    caseMessageTimeline(input, "UTC").map((item) => item.message.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(input, [newest, middle, middle, older]);
  const sent = row("4", "2030-01-01T13:00:00Z");
  assert.equal(
    caseMessageTimeline([sent, ...input], "UTC").at(-1)?.message,
    sent,
  );
  assert.deepEqual(caseMessageTimeline([], "UTC"), []);
});
test("case timeline groups local days once and resolves equal timestamps by message ID", () => {
  const time = "2030-01-01T17:05:00Z";
  const timeline = caseMessageTimeline(
    [row("c", time), row("b", time), row("a", "2030-01-01T16:59:00Z")],
    "Asia/Ho_Chi_Minh",
  );
  assert.deepEqual(
    timeline.map((item) => item.message.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    timeline.map((item) => item.startsDay),
    [true, true, false],
  );
  assert.deepEqual(
    timeline.map((item) => item.time),
    ["23:59", "00:05", "00:05"],
  );
  assert.notEqual(timeline[0]?.day, timeline[1]?.day);
  assert.equal(timeline[1]?.day, timeline[2]?.day);
});
