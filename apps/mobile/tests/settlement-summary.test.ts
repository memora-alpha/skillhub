import assert from "node:assert/strict";
import { test } from "node:test";
import { settlementWaitNote } from "../src/features/learning-paths/utils/settlement-summary";
import { settlementFixture } from "./fixtures/path-changes-data";

test("completion countdown uses the server deadline rather than a hard-coded 48-hour wait", () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  const status = {
    ...settlementFixture("WAITING_DISPUTE_WINDOW"),
    autoSettlementAt: "2030-01-01T05:30:00Z",
  };
  assert.match(settlementWaitNote(status, now), /khoảng 6 giờ/);
  assert.match(settlementWaitNote(status, now + 5 * 3_600_000), /khoảng 1 giờ/);
});
test("reaching the deadline does not claim settlement or mutate the read snapshot", () => {
  const status = {
    ...settlementFixture("READY"),
    autoSettlementAt: "2030-01-01T00:00:00Z",
  };
  assert.match(
    settlementWaitNote(status, Date.parse(status.autoSettlementAt)),
    /đang kiểm tra điều kiện/,
  );
  assert.equal(status.status, "READY");
  assert.equal(status.settledAt, null);
});
test("a missing server deadline shows no invented countdown", () => {
  const message = settlementWaitNote(
    settlementFixture("WAITING_DISPUTE_WINDOW"),
  );
  assert.match(message, /đủ điều kiện/);
  assert.doesNotMatch(message, /\d+ giờ/);
});
