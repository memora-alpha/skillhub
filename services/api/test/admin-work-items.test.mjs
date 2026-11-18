import assert from "node:assert/strict";
import test from "node:test";
import { AdminWorkItemsReader } from "../dist/modules/administration/application/services/admin-work-items.reader.js";
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

function readerFixture() {
  const receivedAt = new Date("2026-11-14T00:00:00Z");
  const rows = Array.from({ length: 131 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    label: index === 130 ? "needle_%" : "ordinary tag",
    status: "PENDING",
    requestedByUserId: "owner",
    reviewedByUserId: null,
    createdAt: receivedAt,
    version: 1,
  }));
  const transactions = {
    run: (work) =>
      work({
        $queryRaw: async () => [{ now: new Date("2026-11-18T00:00:00Z") }],
      }),
  };
  const empty = async () => [];
  const tags = {
    pendingWork: async (_tx, page) =>
      rows
        .filter((row) => {
          const key = {
            receivedAt: row.createdAt,
            kind: "TAG_REQUEST",
            id: row.id,
          };
          if (
            page.cursor &&
            compareWorkKey(key, page.cursor, page.order === "desc") <= 0
          )
            return false;
          if (
            page.receivedAt &&
            (page.order === "asc"
              ? row.createdAt < page.receivedAt
              : row.createdAt > page.receivedAt)
          )
            return false;
          const q = page.filters?.q?.trim().toLowerCase();
          if (
            q &&
            !`TAG_REQUEST-${row.id.slice(0, 8).toUpperCase()} ${row.label} `
              .toLowerCase()
              .includes(q)
          )
            return false;
          return true;
        })
        .slice(0, page.take),
  };
  const reader = new AdminWorkItemsReader(
    transactions,
    {},
    { reviewWork: empty },
    { settlementWork: empty },
    { caseWork: empty, incidentWork: empty },
    { terminationWork: empty },
    { pendingWork: empty },
    tags,
  );
  return { reader, rows };
}

test("work search finds matches beyond the former 101-row source cap", async () => {
  const { reader, rows } = readerFixture();
  const result = await reader.list({
    kind: "TAG_REQUEST",
    q: "needle_%",
    limit: 20,
  });
  assert.deepEqual(
    result.data.map((row) => row.id),
    [rows.at(-1).id],
  );
  assert.equal(result.pagination.hasMore, false);
});

for (const sort of ["oldest", "newest"]) {
  test(`work pagination advances through more than 101 equal timestamps (${sort})`, async () => {
    const { reader, rows } = readerFixture();
    const ids = [];
    let cursor;
    for (let pageNo = 0; pageNo < 10; pageNo += 1) {
      const page = await reader.list({ limit: 20, sort, cursor });
      ids.push(...page.data.map((row) => row.id));
      if (!page.pagination.hasMore) break;
      assert.ok(page.pagination.nextCursor);
      cursor = page.pagination.nextCursor;
    }
    assert.deepEqual(
      ids,
      rows.map((row) => row.id),
    );
    assert.equal(new Set(ids).size, ids.length);
  });
}
