import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { AdminPaymentSourceReader } from "../dist/modules/payments/application/services/admin-payment-source.reader.js";
import { AdminCreditSourceReader } from "../dist/modules/credit/application/services/admin-credit-source.reader.js";
import { AdminReportSourceReader } from "../dist/modules/reports/application/services/admin-report-source.reader.js";
import { AdminLearningPathSourceReader } from "../dist/modules/learning-paths/application/services/admin-learning-path-source.reader.js";
import { AdminVerificationSourceReader } from "../dist/modules/verifications/application/services/admin-verification-source.reader.js";
import { AdminTagRequestSourceReader } from "../dist/modules/skills/application/services/admin-tag-request-source.reader.js";

const sources = [
  [new AdminPaymentSourceReader(), "reviewWork", "payment"],
  [new AdminCreditSourceReader(), "settlementWork", "pathSettlementAttempt"],
  [new AdminReportSourceReader(), "caseWork", "reportCase"],
  [new AdminReportSourceReader(), "incidentWork", "reportIncident"],
  [
    new AdminLearningPathSourceReader(),
    "terminationWork",
    "learningChangeRequest",
  ],
  [new AdminVerificationSourceReader(), "pendingWork", "skillVerification"],
  [new AdminTagRequestSourceReader(), "pendingWork", "tagCreationRequest"],
];

for (const [reader, method, model] of sources) {
  test(`${model} applies work filters and full cursor before the source limit`, async () => {
    const statements = [];
    const tx = {
      [model]: { findMany: async () => [] },
      $queryRaw: async (sql) => {
        statements.push(sql);
        return [];
      },
    };
    await reader[method](tx, {
      order: "asc",
      take: 21,
      cursor: {
        receivedAt: new Date("2026-11-14T00:00:00Z"),
        id: "00000000-0000-4000-8000-000000000123",
        kind: "REPORT_CASE",
      },
      filters: {
        severity: "HIGH",
        waitingOn: "ASSIGNEE",
        assignee: "00000000-0000-4000-8000-000000000456",
        waitingBefore: new Date("2026-11-13T00:00:00Z"),
        q: "needle_%",
      },
    });
    assert.equal(
      statements.length,
      1,
      "source must filter in its database query",
    );
    const [sql] = statements;
    assert.match(sql.text, /strpos\(lower\(/);
    assert.match(sql.text, /"assignee"/);
    assert.match(sql.text, /"severity"/);
    assert.match(sql.text, /"receivedAt"/);
    assert.match(sql.text, /"id"/);
    assert.ok(sql.text.indexOf("WHERE") < sql.text.lastIndexOf("LIMIT"));
    assert.ok(
      sql.values.includes("needle_%"),
      "search input must be a bound literal",
    );
    assert.ok(sql.values.includes("00000000-0000-4000-8000-000000000123"));
    assert.equal(sql.values.at(-1), 21);
  });
}
