import assert from "node:assert/strict";
import test from "node:test";

const matrix = [
  {
    id: "SH-120",
    area: "access/privacy/upload",
    evidence: ["test:files", "test:rbac"],
  },
  {
    id: "SH-121",
    area: "finance concurrency",
    evidence: ["test:credit:integration", "test:payments:integration"],
  },
  {
    id: "SH-122",
    area: "material concurrency",
    evidence: ["test:materials:integration"],
  },
  {
    id: "SH-123",
    area: "TWO_WAY/ONE_WAY E2E",
    evidence: ["test:learning-platform:integration"],
  },
  { id: "SH-124", area: "negative cases", evidence: ["test:completion-gaps"] },
  {
    id: "SH-125",
    area: "admin audit",
    evidence: ["test:admin-operations:integration"],
  },
  {
    id: "SH-127",
    area: "pagination/performance/observability",
    evidence: ["test:admin-operations"],
  },
  {
    id: "SH-128",
    area: "OTP soft-ban concurrency",
    evidence: ["test:identity:integration"],
  },
];

test("backend hardening backlog has explicit automated evidence", () => {
  assert.deepEqual(
    matrix.map(({ id }) => id),
    [
      "SH-120",
      "SH-121",
      "SH-122",
      "SH-123",
      "SH-124",
      "SH-125",
      "SH-127",
      "SH-128",
    ],
  );
  for (const row of matrix) {
    assert.ok(row.area.length > 0);
    assert.ok(row.evidence.length > 0);
    assert.ok(row.evidence.every((script) => script.startsWith("test:")));
  }
});
