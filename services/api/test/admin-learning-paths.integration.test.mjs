import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  createAdminOperationsFixture,
  createHistoricalPath,
  explainAdminQuery,
} from "./admin-operations-fixture.mjs";
import { AdminLearningPathsReader } from "../dist/modules/administration/application/services/admin-learning-paths.reader.js";
import { AdminLearningPathSourceReader } from "../dist/modules/learning-paths/application/services/admin-learning-path-source.reader.js";

const forbiddenProjectionKeys = [
  "accessToken",
  "livekitToken",
  "roomMetadata",
  "messageBody",
  "storageKey",
  "email",
];

test(
  "admin path projection preserves historical plans and excludes private data",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120_000 },
  async () => {
    const f = await createAdminOperationsFixture();
    try {
      const admin = await f.account("ADMIN");
      const participantA = await f.account();
      const participantB = await f.account();
      const { path } = await createHistoricalPath(
        f,
        participantA,
        participantB,
      );
      await f.db.pathSettlementAttempt.create({
        data: {
          pathId: path.id,
          checkedAt: new Date("2026-11-13T00:00:00.000Z"),
          outcome: "FAILED",
          errorCode: "FIXTURE_RETRY_REQUIRED",
          attemptCount: 3,
        },
      });
      const report = await f.db.reportCase.create({
        data: {
          reporterId: participantA.user.id,
          targetType: "USER",
          targetId: participantB.user.id,
          reasonCode: "OTHER",
          description: "Historical path report fixture",
          status: "OPEN",
          severity: "MEDIUM",
          blocksSettlement: true,
          relatedPathId: path.id,
          createdAt: new Date("2026-11-14T00:00:00.000Z"),
        },
      });
      const termination = await f.db.learningChangeRequest.create({
        data: {
          pathId: path.id,
          kind: "PATH_TERMINATION",
          status: "STAFF_REVIEW",
          requesterId: participantA.user.id,
          reason: "Historical path termination fixture",
          idempotencyKey: randomUUID(),
          instructionDigest: "b".repeat(64),
          policySnapshot: {},
          createdAt: new Date("2026-11-15T00:00:00.000Z"),
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
        },
      });
      const source = new AdminLearningPathSourceReader();
      const reader = new AdminLearningPathsReader(
        f.transactions,
        f.audit,
        source,
      );

      const page = await reader.list({
        limit: 10,
        status: "ACTIVE",
        participantId: participantA.user.id,
      });
      assert.equal(page.data.length, 1);
      assert.equal(page.data[0].id, path.id);
      assert.equal(page.data[0].currentVersion, 2);
      assert.equal(page.data[0].lockedVersion, 2);

      const detail = await reader.detail(admin.principal, path.id);
      assert.deepEqual(
        detail.versions.map((version) => version.versionNo),
        [2, 1],
      );
      assert.deepEqual(
        detail.versions.map(
          (version) => version.pathVersionPlanPathVersionRecords[0].planVersion,
        ),
        [2, 1],
      );
      assert.deepEqual(
        detail.sessions.map((session) => session.planVersion),
        [1, 2],
      );
      assert.equal(detail.settlement.attempt.attemptCount, 3);
      assert.equal(detail.reports[0].id, report.id);
      assert.equal(detail.terminations[0].id, termination.id);
      assert.equal(
        await f.db.auditLog.count({
          where: {
            action: "ADMIN_LEARNING_PATH_READ",
            targetId: path.id,
          },
        }),
        1,
      );
      const serialized = JSON.stringify(detail);
      for (const key of forbiddenProjectionKeys)
        assert.equal(new RegExp(`"${key}"`, "u").test(serialized), false, key);
      const listPlan = await explainAdminQuery(
        f.client,
        "admin-learning-path-list",
        "SELECT path_id FROM learning_paths WHERE status = 'ACTIVE' ORDER BY updated_at DESC, path_id DESC LIMIT 11",
      );
      assert.ok(listPlan.executionMs < 1_000);
    } finally {
      await f.dispose();
    }
  },
);
