import assert from "node:assert/strict";
import test from "node:test";
import {
  adminDayBuckets,
  adminReportingWindow,
} from "../dist/modules/administration/domain/admin-reporting-window.js";

test("reporting windows are [from,to), timezone-aware and mark partial days", () => {
  const window = adminReportingWindow({
    from: "2026-11-13T18:00:00.000Z",
    to: "2026-11-15T06:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
  });
  const buckets = adminDayBuckets(window);
  assert.deepEqual(
    buckets.map(({ localDate, partial }) => ({ localDate, partial })),
    [
      { localDate: "2026-11-14", partial: true },
      { localDate: "2026-11-15", partial: true },
    ],
  );
  assert.equal(buckets[0].fromUtc.toISOString(), "2026-11-13T17:00:00.000Z");
});

test("DST day boundaries remain unambiguous", () => {
  const buckets = adminDayBuckets(
    adminReportingWindow({
      from: "2026-03-08T05:00:00.000Z",
      to: "2026-03-09T04:00:00.000Z",
      timezone: "America/New_York",
    }),
  );
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].localDate, "2026-03-08");
  assert.equal(
    buckets[0].toUtc.getTime() - buckets[0].fromUtc.getTime(),
    23 * 3_600_000,
  );
  assert.equal(buckets[0].partial, false);
});

test("invalid timezone, reversed and oversized windows fail", () => {
  for (const input of [
    {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T00:00:00Z",
      timezone: "Mars/Test",
    },
    {
      from: "2026-01-02T00:00:00Z",
      to: "2026-01-01T00:00:00Z",
      timezone: "UTC",
    },
    {
      from: "2025-01-01T00:00:00Z",
      to: "2026-01-03T00:00:00Z",
      timezone: "UTC",
    },
  ])
    assert.throws(
      () => adminReportingWindow(input),
      /INVALID_ADMIN_REPORTING_WINDOW/,
    );
});
