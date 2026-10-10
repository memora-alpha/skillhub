import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalDateTime } from "../src/utils/local-date-time";
test("local date input rejects rollover dates and invalid times instead of moving the session", () => {
  for (const value of [
    "2026-02-30T19:00",
    "2026-13-01T19:00",
    "2026-01-00T19:00",
    "2026-10-10T24:00",
    "2026-10-10T19:60",
    "2026-10-10",
    "invalid",
  ])
    assert.equal(parseLocalDateTime(value), undefined);
  const valid = parseLocalDateTime("2028-02-29T19:30")!;
  assert.equal(valid.getFullYear(), 2028);
  assert.equal(valid.getMonth(), 1);
  assert.equal(valid.getDate(), 29);
  assert.equal(valid.getHours(), 19);
  assert.equal(valid.getMinutes(), 30);
});
