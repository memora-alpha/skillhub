import assert from "node:assert/strict";
import test from "node:test";
import { sessionsFixture, now } from "./fixtures/sessions-client";
import {
  sessionPresentation,
  matchesSessionFilter,
} from "../src/features/sessions/utils/session-presentation";
import { confirmationLabel } from "../src/features/sessions/utils/session-policy";

test("ended sessions stay awaiting completion confirmation until server marks them completed", () => {
  const session = { ...sessionsFixture().record, status: "CONFIRMED" as const };
  assert.equal(
    sessionPresentation(session, now).label,
    "Đã kết thúc · chờ xác nhận",
  );
  assert.equal(matchesSessionFilter(session, "Chờ xác nhận", now), true);
  assert.equal(matchesSessionFilter(session, "Đã hoàn thành", now), false);
  const completed = { ...session, status: "COMPLETED" as const };
  assert.equal(sessionPresentation(completed, now).label, "Đã hoàn thành");
  assert.equal(matchesSessionFilter(completed, "Đã hoàn thành", now), true);
  assert.equal(confirmationLabel(null), "Chưa xác nhận hoàn thành");
});

test("upcoming, current, cancelled and disputed sessions have distinct presentations and filters", () => {
  const session = { ...sessionsFixture().record, status: "CONFIRMED" as const };
  const before = Date.parse(session.startAt) - 1;
  const during = Date.parse(session.startAt);
  assert.equal(sessionPresentation(session, before).label, "Sắp tới");
  assert.equal(matchesSessionFilter(session, "Sắp tới", before), true);
  assert.equal(
    sessionPresentation(session, during).label,
    "Đang trong giờ học",
  );
  assert.equal(matchesSessionFilter(session, "Đang học", during), true);
  for (const status of ["CANCELLED", "DISPUTED"] as const) {
    const blocked = { ...session, status };
    assert.equal(
      matchesSessionFilter(blocked, "Đã hủy / tranh chấp", before),
      true,
    );
    assert.equal(matchesSessionFilter(blocked, "Sắp tới", before), false);
    assert.equal(matchesSessionFilter(blocked, "Chờ xác nhận", now), false);
  }
});
