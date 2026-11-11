import assert from "node:assert/strict";
import test from "node:test";
import { sessionsFixture, now } from "./fixtures/sessions-client";
import { sessionPresentation } from "../src/features/sessions/utils/session-presentation";
import { confirmationLabel } from "../src/features/sessions/utils/session-policy";
import { noShowGuidance } from "../src/features/sessions/utils/attendance-presentation";

test("elapsed time does not imply an ongoing or completed session without server status", () => {
  const session = { ...sessionsFixture().record, status: "CONFIRMED" as const };
  assert.equal(sessionPresentation(session, now).label, "Đã hết giờ học");
  for (const status of ["ONGOING", "AWAITING_CONFIRMATION"] as const)
    assert.equal(
      sessionPresentation({ ...session, status }, now).label,
      "Đã kết thúc · chờ xác nhận",
    );
  const completed = { ...session, status: "COMPLETED" as const };
  assert.equal(sessionPresentation(completed, now).label, "Đã hoàn thành");
  assert.equal(session.status, "CONFIRMED");
  assert.equal(confirmationLabel(null), "Chưa xác nhận hoàn thành");
});

test("both-absent guidance distinguishes waiting, finalizing and review without promising a makeup grant", () => {
  const session = {
    ...sessionsFixture().record,
    status: "NO_SHOW" as const,
    attendance: {
      state: "DETERMINED" as const,
      case: "BOTH_ABSENT" as const,
      outcomeStatus: "PROVISIONAL",
    },
    deadlines: {
      confirmBy: null,
      makeupBy: null,
      excuseOrReportBy: new Date(now + 1000).toISOString(),
    },
  };
  assert.match(noShowGuidance(session, now)!, /xét học bù sau hạn phản hồi/);
  assert.match(noShowGuidance(session, now + 1000)!, /Đang chốt kết quả/);
  assert.match(
    noShowGuidance(
      {
        ...session,
        attendance: { ...session.attendance, outcomeStatus: "DISPUTED" },
      },
      now,
    )!,
    /xem xét/,
  );
  assert.equal(
    noShowGuidance({ ...session, attendance: undefined }, now),
    undefined,
  );
  assert.equal(
    noShowGuidance({ ...session, status: "MAKEUP_REQUIRED" }, now),
    undefined,
  );
});

test("upcoming, current, cancelled and disputed sessions have distinct presentations", () => {
  const session = { ...sessionsFixture().record, status: "CONFIRMED" as const };
  const before = Date.parse(session.startAt) - 1;
  const during = Date.parse(session.startAt);
  assert.equal(sessionPresentation(session, before).label, "Sắp tới");
  assert.equal(sessionPresentation(session, during).label, "Chờ bắt đầu");
  assert.equal(
    sessionPresentation({ ...session, status: "ONGOING" }, during).label,
    "Đang học",
  );
  for (const status of ["CANCELLED", "DISPUTED"] as const) {
    const blocked = { ...session, status };
    for (const at of [before, during, now]) {
      const presentation = sessionPresentation(blocked, at);
      assert.equal(
        presentation.label,
        status === "CANCELLED" ? "Đã hủy" : "Đang tranh chấp",
      );
      assert.equal(
        presentation.variant,
        status === "CANCELLED" ? "default" : "warning",
      );
    }
  }
});
