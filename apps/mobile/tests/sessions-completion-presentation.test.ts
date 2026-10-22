import assert from "node:assert/strict";
import test from "node:test";
import { completionSubmitPresentation } from "../src/features/sessions/utils/completion-presentation";
import { sessionSchema } from "../src/features/sessions/types";
import {
  sessionRecord,
  teacherId,
  learnerId,
} from "./fixtures/sessions-client";

const session = () => sessionSchema.parse(sessionRecord());
test("only own confirmation changes the label; the partner can still confirm", () => {
  const value = { ...session(), teacherConfirmationStatus: "CONFIRMED" };
  assert.deepEqual(
    completionSubmitPresentation(value, teacherId, undefined, false),
    { confirmed: true, label: "Đã xác nhận" },
  );
  assert.equal(
    completionSubmitPresentation(value, learnerId, undefined, false).confirmed,
    false,
  );
});
test("successful receipt locks confirmed presentation while detail refresh is pending", () => {
  const value = session();
  assert.deepEqual(
    completionSubmitPresentation(
      value,
      teacherId,
      { id: value.id, status: "AWAITING_CONFIRMATION" },
      true,
    ),
    { confirmed: true, label: "Đã xác nhận" },
  );
});
test("pending or unknown POST outcome must not claim confirmation", () => {
  const value = session();
  assert.deepEqual(
    completionSubmitPresentation(value, teacherId, undefined, true),
    { confirmed: false, label: "Đang xử lý…" },
  );
  assert.equal(
    completionSubmitPresentation(value, teacherId, undefined, false).confirmed,
    false,
  );
  assert.equal(
    completionSubmitPresentation(
      value,
      teacherId,
      { id: learnerId, status: "COMPLETED" },
      false,
    ).confirmed,
    false,
  );
});
test("completed sessions stay confirmed but unrelated account has no own confirmation", () => {
  const value = { ...session(), status: "COMPLETED" as const };
  assert.equal(
    completionSubmitPresentation(value, teacherId, undefined, false).confirmed,
    true,
  );
  assert.equal(
    completionSubmitPresentation(value, value.pathId, undefined, false)
      .confirmed,
    false,
  );
  assert.equal(
    completionSubmitPresentation(undefined, teacherId, undefined, false)
      .confirmed,
    false,
  );
});
