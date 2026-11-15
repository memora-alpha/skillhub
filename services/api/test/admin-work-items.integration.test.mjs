import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  createAdminOperationsFixture,
  createHistoricalPath,
  explainAdminQuery,
} from "./admin-operations-fixture.mjs";
import { AdminWorkItemsReader } from "../dist/modules/administration/application/services/admin-work-items.reader.js";
import { AdminPaymentSourceReader } from "../dist/modules/payments/application/services/admin-payment-source.reader.js";
import { AdminCreditSourceReader } from "../dist/modules/credit/application/services/admin-credit-source.reader.js";
import { AdminReportSourceReader } from "../dist/modules/reports/application/services/admin-report-source.reader.js";
import { AdminLearningPathSourceReader } from "../dist/modules/learning-paths/application/services/admin-learning-path-source.reader.js";
import { AdminVerificationSourceReader } from "../dist/modules/verifications/application/services/admin-verification-source.reader.js";
import { AdminTagRequestSourceReader } from "../dist/modules/skills/application/services/admin-tag-request-source.reader.js";

test(
  "mixed authoritative work sources paginate and audit against isolated PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120_000 },
  async () => {
    const f = await createAdminOperationsFixture();
    try {
      const admin = await f.account("ADMIN");
      const owner = await f.account();
      const participant = await f.account();
      const { path } = await createHistoricalPath(f, owner, participant);
      const times = Array.from(
        { length: 7 },
        (_, index) => new Date(Date.UTC(2026, 10, 10, index)),
      );
      const payment = await f.db.payment.create({
        data: {
          userId: owner.user.id,
          paymentAmountVnd: 100_000n,
          creditAmount: 100n,
          currency: "VND",
          gateway: "PAYOS",
          status: "REVIEW",
          createdAt: times[0],
        },
      });
      await f.db.pathSettlementAttempt.create({
        data: {
          pathId: path.id,
          checkedAt: times[1],
          outcome: "NEEDS_REVIEW",
          errorCode: "FIXTURE_SETTLEMENT_FAILURE",
          attemptCount: 2,
        },
      });
      const reportCase = await f.db.reportCase.create({
        data: {
          reporterId: owner.user.id,
          targetType: "USER",
          targetId: participant.user.id,
          reasonCode: "OTHER",
          description: "Admin work item fixture report case",
          status: "OPEN",
          blocksSettlement: false,
          createdAt: times[2],
          relatedPathId: path.id,
        },
      });
      const incident = await f.db.reportIncident.create({
        data: {
          targetType: "USER",
          targetId: participant.user.id,
          status: "OPEN",
          severity: "HIGH",
          reason: "Admin work item fixture incident",
          handlerId: admin.user.id,
          createdAt: times[3],
        },
      });
      const termination = await f.db.learningChangeRequest.create({
        data: {
          pathId: path.id,
          kind: "PATH_TERMINATION",
          status: "STAFF_REVIEW",
          requesterId: owner.user.id,
          reason: "Admin work item fixture termination",
          idempotencyKey: randomUUID(),
          instructionDigest: "a".repeat(64),
          policySnapshot: {},
          createdAt: times[4],
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
        },
      });
      const sharing = await f.db.sharingSkill.create({
        data: {
          userId: owner.user.id,
          skillId: f.skill.id,
          level: "BEGINNER",
          description: "A valid sharing skill for admin verification work",
          verificationStatus: "UNVERIFIED",
          isVisible: true,
        },
      });
      const verification = await f.db.skillVerification.create({
        data: {
          sharingSkillId: sharing.id,
          status: "PENDING",
          submittedAt: times[5],
        },
      });
      const tag = await f.db.tagCreationRequest.create({
        data: {
          label: "Admin fixture tag",
          labelKey: `admin-fixture-${randomUUID()}`,
          requestedByUserId: owner.user.id,
          createdAt: times[6],
        },
      });

      const reader = new AdminWorkItemsReader(
        f.transactions,
        f.audit,
        new AdminPaymentSourceReader(),
        new AdminCreditSourceReader(),
        new AdminReportSourceReader(),
        new AdminLearningPathSourceReader(),
        new AdminVerificationSourceReader(),
        new AdminTagRequestSourceReader(),
      );
      const page = await reader.list({ limit: 100, sort: "oldest" });
      assert.deepEqual(
        page.data.map((row) => row.kind),
        [
          "PAYMENT_REVIEW",
          "SETTLEMENT_REVIEW",
          "REPORT_CASE",
          "REPORT_INCIDENT",
          "PATH_TERMINATION",
          "SKILL_VERIFICATION",
          "TAG_REQUEST",
        ],
      );
      assert.equal(page.pagination.hasMore, false);
      assert.equal(
        page.data.find((row) => row.id === termination.id)?.severity,
        "UNCLASSIFIED",
      );
      assert.equal(
        page.data.find((row) => row.id === verification.id)?.severity,
        "UNCLASSIFIED",
      );
      assert.equal(
        page.data.find((row) => row.id === tag.id)?.severity,
        "UNCLASSIFIED",
      );
      assert.equal(
        page.data.find((row) => row.id === incident.id)?.severity,
        "HIGH",
      );

      const detail = await reader.detail(
        admin.principal,
        "PAYMENT_REVIEW",
        payment.id,
      );
      assert.equal(detail.status, "REVIEW");
      assert.equal(detail.paymentAmountVnd, 100_000n);
      assert.equal(
        await f.db.auditLog.count({
          where: {
            action: "ADMIN_WORK_ITEM_READ",
            targetId: payment.id,
          },
        }),
        1,
      );
      assert.equal(reportCase.relatedPathId, path.id);
      const paymentPlan = await explainAdminQuery(
        f.client,
        "payment-review-work",
        "SELECT payment_id FROM payments WHERE status = 'REVIEW' ORDER BY created_at ASC, payment_id ASC LIMIT 101",
      );
      const reportPlan = await explainAdminQuery(
        f.client,
        "report-case-work",
        "SELECT case_id FROM report_cases WHERE status <> 'RESOLVED' ORDER BY created_at ASC, case_id ASC LIMIT 101",
      );
      assert.ok(paymentPlan.executionMs < 1_000);
      assert.ok(reportPlan.executionMs < 1_000);
    } finally {
      await f.dispose();
    }
  },
);
