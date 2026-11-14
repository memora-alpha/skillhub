import assert from "node:assert/strict";
import test from "node:test";
import {
  compareWorkKey,
  decodeWorkCursor,
  encodeWorkCursor,
} from "../dist/modules/administration/domain/admin-work-item-cursor.js";

test("work cursor is filter-bound and deterministic across source kinds", () => {
  const scope = JSON.stringify(["kind", "REPORT_CASE"]);
  const cursor = {
    scope,
    receivedAt: new Date("2026-11-14T00:00:00.000Z"),
    kind: "REPORT_CASE",
    id: "00000000-0000-4000-8000-000000000001",
  };
  assert.deepEqual(decodeWorkCursor(encodeWorkCursor(cursor), scope), cursor);
  assert.throws(
    () => decodeWorkCursor(encodeWorkCursor(cursor), "different"),
    /INVALID_ADMIN_WORK_CURSOR/,
  );
  assert.ok(
    compareWorkKey(cursor, { ...cursor, kind: "TAG_REQUEST" }, false) < 0,
  );
});
