import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import { AuditWriter } from "../../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { ConversationMembershipReader } from "../../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { CreditLedgerAdapter } from "../../dist/modules/credit/application/services/credit-ledger.adapter.js";
import { CreditLedgerService } from "../../dist/modules/credit/application/services/credit-ledger.service.js";
import { CreditWalletReader } from "../../dist/modules/credit/application/services/credit-wallet.reader.js";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { LearningPathsService } from "../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { SchedulingService } from "../../dist/modules/scheduling/application/services/scheduling.service.js";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { LearningRequestPathReader } from "../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { defaultConfiguration, plan, slots, user } from "./fixtures.mjs";

const url = process.env.TEST_DATABASE_URL;

/** Every transaction this runner opens fails on its last write, the outbox event. */
function failingOnOutbox(transactions) {
  const failing = (tx) =>
    new Proxy(tx, {
      get(target, property) {
        if (property === "outboxEvent") {
          return {
            create: async () => {
              throw new Error("outbox unavailable");
            },
          };
        }
        const value = target[property];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return {
    run: (work, options) =>
      transactions.run((tx) => work(failing(tx)), options),
  };
}

async function seedParticipants(db) {
  const role = await db.role.findUniqueOrThrow({ where: { code: "USER" } });
  const [teacher, learner] = [randomUUID(), randomUUID()];
  for (const id of [teacher, learner]) {
    await db.user.create({
      data: {
        id,
        roleId: role.id,
        normalizedEmail: `${id}@learning-paths.test`,
        fullName: "Path participant",
        emailVerified: true,
        accountStatus: "ACTIVE",
        securityVersion: 1,
        failedLoginCount: 0,
        locale: "vi",
        verifiedSkillCount: 0,
        completedSessionCount: 0,
        termsVersion: "test",
        termsAcceptedAt: new Date(),
      },
    });
    await db.creditWallet.create({
      data: {
        userId: id,
        availableCredit: 5000n,
        heldCredit: 0n,
        purchasedCredit: 5000n,
        bonusCredit: 0n,
        walletVersion: 0,
      },
    });
  }
  const skill = await db.skill.create({
    data: {
      name: "Learning path test",
      nameKey: randomUUID(),
      slug: randomUUID(),
      status: "ACTIVE",
    },
  });
  const request = await db.learningRequest.create({
    data: {
      ownerId: learner,
      skillId: skill.id,
      title: "Learning path request",
      description: "Description for a learning path request",
      learningGoal: "A suitable learning goal",
      currentLevel: "BEGINNER",
      status: "NEGOTIATING",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const proposal = await db.proposal.create({
    data: {
      sourceType: "LEARNING_REQUEST",
      requestId: request.id,
      proposerId: teacher,
      recipientId: learner,
      skillId: skill.id,
      message: "A suitable proposal",
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const conversation = await db.conversation.create({
    data: {
      proposalId: proposal.id,
      requestId: request.id,
      participantAId: teacher,
      participantBId: learner,
    },
  });
  await db.$transaction((tx) => seedPathFeePolicies(tx));
  return {
    A: teacher,
    B: learner,
    skillId: skill.id,
    conversationId: conversation.id,
    requestId: request.id,
  };
}

test(
  "SH-055: a failure after Hold, LOCK and session creation rolls back the whole finalize",
  { skip: !url && "Set TEST_DATABASE_URL to an isolated PostgreSQL server" },
  async () => {
    const schema = `paths_test_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    let db;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const root = new URL("../../prisma/migrations/", import.meta.url);
      // Migrations must run in chronological order.
      for (const name of (await readdir(root))
        .filter((entry) => /^2026/.test(entry))
        .sort((left, right) => left.localeCompare(right))) {
        await client.query(
          await readFile(new URL(`${name}/migration.sql`, root), "utf8"),
        );
      }
      db = new PrismaClient({
        adapter: new PrismaPg(
          { connectionString: url, options: `-c search_path=${schema}` },
          { schema },
        ),
      });
      await db.$connect();
      const { A, B, skillId, conversationId, requestId } =
        await seedParticipants(db);

      const transactions = new TransactionRunner(db);
      const configuration = {
        getSnapshot: async (keys) => ({
          values: Object.fromEntries(
            keys.map((key) => [key, defaultConfiguration[key]]),
          ),
        }),
      };
      const wallet = new CreditLedgerAdapter(
        new CreditWalletReader(),
        new CreditLedgerService(),
      );
      const pathsWith = (runner) =>
        new LearningPathsService(
          runner,
          new ConversationMembershipReader(),
          wallet,
          configuration,
          new IdempotencyService(runner),
          new LearningRequestLifecycleService(
            new PrismaLearningRequestRepository(db),
          ),
          new LearningRequestPathReader(),
        );
      const paths = pathsWith(transactions);
      const schedules = new SchedulingService(
        transactions,
        new AuditWriter(new AuditRepository()),
        configuration,
      );

      const { id: pathId } = await paths.create(user(A), {
        conversationId,
        exchangeType: "TWO_WAY",
        totalCreditPerUser: "20.00",
      });
      const planAB = await paths.addPlan(user(A), pathId, {
        ...plan(),
        skillId,
      });
      const planBA = await paths.addPlan(user(B), pathId, {
        ...plan(),
        skillId,
      });
      await paths.confirmPlan(user(B), planAB.id, 1);
      await paths.confirmPlan(user(A), planBA.id, 1);
      await paths.confirmAgreement(user(A), pathId, 1);
      await paths.confirmAgreement(user(B), pathId, 1);
      const future = new Date(Date.now() + 7 * 86_400_000);
      for (const [teacher, planId, offsetHours] of [
        [A, planAB.id, 0],
        [B, planBA.id, 3],
      ]) {
        const start = new Date(future.getTime() + offsetHours * 3_600_000);
        const end = new Date(start.getTime() + 3_600_000);
        const schedule = await schedules.createProposal(user(teacher), planId, {
          expectedPlanVersion: 1,
          items: slots([start.toISOString(), end.toISOString()]),
        });
        await schedules.confirmProposal(user(A), schedule.id, 1);
        await schedules.confirmProposal(user(B), schedule.id, 1);
      }

      await assert.rejects(
        pathsWith(failingOnOutbox(transactions)).finalize(
          { principal: user(A), key: "finalize-attempt-1" },
          pathId,
          1,
        ),
        /outbox unavailable/,
      );

      const path = await db.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      assert.deepEqual([path.status, path.lockedVersion], ["CONFIRMED", null]);
      assert.equal(
        (
          await db.learningRequest.findUniqueOrThrow({
            where: { id: requestId },
          })
        ).status,
        "NEGOTIATING",
      );
      assert.equal(await db.session.count({ where: { pathId } }), 0);
      assert.equal(await db.sessionScheduleHistory.count(), 0);
      assert.equal(await db.heldCreditAllocation.count(), 0);
      assert.equal(await db.creditOperation.count(), 0);
      assert.equal(await db.creditTransaction.count(), 0);
      assert.equal(await db.idempotencyRecord.count(), 0);
      assert.equal(
        await db.scheduleProposal.count({ where: { status: "LOCKED" } }),
        0,
      );
      const agreement = await db.learningPathVersion.findUniqueOrThrow({
        where: { pathId_versionNo: { pathId, versionNo: 1 } },
      });
      assert.equal(agreement.feePolicyId, null);
      for (const id of [A, B]) {
        const row = await db.creditWallet.findUniqueOrThrow({
          where: { userId: id },
        });
        assert.deepEqual([row.availableCredit, row.heldCredit], [5000n, 0n]);
      }

      const result = await paths.finalize(
        { principal: user(A), key: "finalize-attempt-2" },
        pathId,
        1,
      );
      assert.equal(result.status, "SCHEDULED");
      assert.equal(
        (
          await db.learningRequest.findUniqueOrThrow({
            where: { id: requestId },
          })
        ).status,
        "MATCHED",
      );
      assert.equal(await db.session.count({ where: { pathId } }), 2);
      await paths.finalize(
        { principal: user(B), key: "finalize-attempt-3" },
        pathId,
        1,
      );
      assert.equal(await db.creditOperation.count(), 1);
      for (const id of [A, B]) {
        const row = await db.creditWallet.findUniqueOrThrow({
          where: { userId: id },
        });
        assert.deepEqual([row.availableCredit, row.heldCredit], [3000n, 2000n]);
      }
    } finally {
      await db?.$disconnect();
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`);
      await client.end();
    }
  },
);
