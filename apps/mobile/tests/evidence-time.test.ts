import test from "node:test";
import assert from "node:assert/strict";
import { evidenceTime } from "../src/features/skills/utils/evidence-time";
import { skillError } from "../src/features/skills/utils/skill-errors";
import { AppError } from "../src/lib/http/errors";

test("UTC and explicit UTC+7 server timestamps render the same Vietnam instant", () => {
  const utc = evidenceTime("2026-10-12T16:29:10.915Z");
  assert.equal(utc, evidenceTime("2026-10-12T23:29:10.915+07:00"));
  assert.match(utc, /23:29:10/);
  assert.match(utc, /12\/10\/2026/);
  assert.match(utc, /giờ Việt Nam/);
});

test("a server UTC timestamp crosses midnight once without undoing a possible backend offset error", () => {
  const result = evidenceTime("2026-10-12T23:29:10.915Z");
  assert.match(result, /06:29:10/);
  assert.match(result, /13\/10\/2026/);
});

test("timestamps without a zone or invalid timestamps cannot be interpreted as device-local save time", () => {
  for (const value of ["2026-10-12T23:29:10", "invalid", ""])
    assert.equal(evidenceTime(value), "Thời gian không khả dụng");
});

test("masked 503 does not invent a storage or scan diagnosis and an unconfirmed write remains uncertain", () => {
  const error = new AppError("http", 503, "Internal server error");
  assert.equal(
    skillError(error),
    "Máy chủ chưa sẵn sàng xử lý yêu cầu. Hãy thử lại sau.",
  );
  assert.match(skillError(error, true), /Chưa xác nhận được kết quả/);
});
