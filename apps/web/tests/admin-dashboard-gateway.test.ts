import assert from "node:assert/strict";
import { test } from "node:test";
import { upstreamPath } from "../src/lib/staff/policy";
import { staffQuery } from "../src/lib/staff/query";

test("dashboard routes are GET-only and restricted to the Admin portal", () => {
  for (const section of ["overview", "learning", "finance"]) {
    const path = `dashboard/${section}`;
    assert.equal(upstreamPath("GET", path, "admin"), `admin/${path}`);
    assert.equal(upstreamPath("GET", path, "staff"), null);
    assert.equal(upstreamPath("POST", path, "admin"), null);
  }
  assert.equal(upstreamPath("GET", "dashboard/invalid", "admin"), null);
});

test("dashboard forwards only the filters its upstream controller accepts", () => {
  const incoming = new URLSearchParams({
    from: "2026-11-01T00:00:00+07:00",
    to: "2026-12-01T00:00:00+07:00",
    timezone: "Asia/Ho_Chi_Minh",
    granularity: "month",
    sections: "kpis,feeSeries",
    status: "PAID",
    limit: "20",
  });
  const query = new URLSearchParams(staffQuery("dashboard/finance", incoming));
  assert.deepEqual(Object.fromEntries(query), {
    from: incoming.get("from"),
    to: incoming.get("to"),
    timezone: "Asia/Ho_Chi_Minh",
    granularity: "month",
    sections: "kpis,feeSeries",
  });
  const paymentQuery = new URLSearchParams(staffQuery("payments", incoming));
  assert.equal(paymentQuery.get("from"), incoming.get("from"));
  assert.equal(paymentQuery.get("status"), "PAID");
  assert.equal(paymentQuery.has("timezone"), false);
  const drilldown = new URLSearchParams({
    paidFrom: incoming.get("from")!,
    paidBefore: incoming.get("to")!,
    includeTotal: "true",
  });
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(staffQuery("payments", drilldown))),
    Object.fromEntries(drilldown),
  );
  assert.equal(
    staffQuery("credit/transactions", drilldown),
    "?includeTotal=true",
  );
});
