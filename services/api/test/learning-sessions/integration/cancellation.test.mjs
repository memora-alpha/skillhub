import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "../../skills/helpers.mjs";
import { defaultConfiguration } from "../../learning-platform/fixtures.mjs";
import { LearningChangeState } from "../../../dist/modules/learning-paths/application/services/learning-change-state.js";
import { PathTerminationService } from "../../../dist/modules/learning-paths/application/services/path-termination.service.js";
import { SessionChangesService } from "../../../dist/modules/learning-sessions/application/services/session-changes.service.js";
import { PathTerminationLedgerService } from "../../../dist/modules/credit/application/services/path-termination-ledger.service.js";
import { CreditProvenanceService } from "../../../dist/modules/credit/application/services/credit-provenance.service.js";
import { CreditOperationsService } from "../../../dist/modules/credit/application/services/credit-operations.service.js";
import { CreditLedgerService } from "../../../dist/modules/credit/application/services/credit-ledger.service.js";
import { CreditLedgerAdapter } from "../../../dist/modules/credit/application/services/credit-ledger.adapter.js";
import { CreditWalletReader } from "../../../dist/modules/credit/application/services/credit-wallet.reader.js";
import { LearningPathsService } from "../../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { LearningRequestLifecycleService } from "../../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { PrismaLearningRequestRepository } from "../../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { LearningRequestPathReader } from "../../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { ConversationMembershipReader } from "../../../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { SchedulingService } from "../../../dist/modules/scheduling/application/services/scheduling.service.js";
import { seedPathFeePolicies } from "../../../dist/modules/credit/application/seed-fee-policies.js";
import { previewLifecycle } from "../../../scripts/reconcile-learning-requests.mjs";

test(
  "PostgreSQL: cancellation and early termination preserve money, history and atomicity",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "TEST_DATABASE_URL required for isolated schema",
  },
  async (t) => {
    const f = await createSkillFixture();
    try {
      const admin = await f.account("ADMIN");
      const reviewer = {
        ...admin.principal,
        permissions: ["report:moderate", "credit:adjust", "dispute:override"],
      };
      await f.transactions.run((tx) => seedPathFeePolicies(tx));
      const provenance = new CreditProvenanceService();
      const operations = new CreditOperationsService(provenance);
      const ledger = new PathTerminationLedgerService(operations, provenance);
      const wallet = new CreditLedgerAdapter(
        new CreditWalletReader(),
        new CreditLedgerService(provenance),
      );
      const requests = new LearningRequestLifecycleService(
        new PrismaLearningRequestRepository(f.db),
      );
      const requestPaths = new LearningRequestPathReader();
      const mutableAudit = { append: (...args) => f.audit.append(...args) };
      const values = {
        ...defaultConfiguration,
        "learningPath.changeRequests": {
          requestWindowHours: 72,
          terminationPolicyReference: "test-approved-policy-v1",
        },
      };
      const configuration = {
        getSnapshot: async (keys) => ({
          values: Object.fromEntries(keys.map((key) => [key, values[key]])),
        }),
      };
      const state = new LearningChangeState(mutableAudit, configuration);
      const cancellations = new SessionChangesService(f.transactions, state);
      const stop = new PathTerminationService(
        f.transactions,
        state,
        cancellations,
        ledger,
        requests,
        requestPaths,
      );
      const paths = new LearningPathsService(
        f.transactions,
        new ConversationMembershipReader(),
        wallet,
        configuration,
        f.commands,
        requests,
        requestPaths,
      );
      const schedules = new SchedulingService(
        f.transactions,
        f.audit,
        configuration,
      );

      async function agreement(twoWay = false) {
        const teacher = await f.account(),
          learner = await f.account();
        for (const person of [teacher, learner])
          await f.transactions.run((tx) =>
            operations.topUp(tx, {
              userId: person.user.id,
              paymentId: randomUUID(),
              amount: 10000n,
              receiptDigest: "isolated-test-funding",
            }),
          );
        const skill = await f.db.skill.create({
          data: {
            name: `Cancellation ${randomUUID()}`,
            nameKey: randomUUID(),
            slug: randomUUID(),
            status: "ACTIVE",
          },
        });
        const request = await f.db.learningRequest.create({
          data: {
            ownerId: learner.user.id,
            skillId: skill.id,
            title: "Cancellation fixture",
            description: "An isolated learning request",
            learningGoal: "Learn cancellation",
            currentLevel: "BEGINNER",
            status: "NEGOTIATING",
            publishedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        const proposal = await f.db.proposal.create({
          data: {
            sourceType: "LEARNING_REQUEST",
            requestId: request.id,
            proposerId: teacher.user.id,
            recipientId: learner.user.id,
            skillId: skill.id,
            message: "Test proposal",
            status: "ACCEPTED",
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        const conversation = await f.db.conversation.create({
          data: {
            proposalId: proposal.id,
            requestId: request.id,
            participantAId: teacher.user.id,
            participantBId: learner.user.id,
          },
        });
        const terms = twoWay
          ? { exchangeType: "TWO_WAY", totalCreditPerUser: "20.00" }
          : {
              exchangeType: "ONE_WAY",
              teacherId: teacher.user.id,
              learnerId: learner.user.id,
              negotiatedCredit: "100.00",
            };
        const path = await paths.create(learner.principal, {
          conversationId: conversation.id,
          ...terms,
        });
        const plans = [];
        for (const [index, owner, student] of twoWay
          ? [
              [0, teacher, learner],
              [1, learner, teacher],
            ]
          : [[0, teacher, learner]]) {
          const plan = await paths.addPlan(owner.principal, path.id, {
            skillId: skill.id,
            learningGoal: "A test goal",
            totalSessions: 1,
            sessionOutline: [{ content: "One lesson" }],
          });
          await paths.confirmPlan(student.principal, plan.id, 1);
          plans.push({ plan, index, owner });
        }
        await paths.confirmAgreement(teacher.principal, path.id, 1);
        await paths.confirmAgreement(learner.principal, path.id, 1);
        for (const { plan, index, owner } of plans) {
          const startAt = new Date(Date.now() + (7 + index) * 86400000);
          const schedule = await schedules.createProposal(
            owner.principal,
            plan.id,
            {
              expectedPlanVersion: 1,
              items: [
                {
                  sessionNo: 1,
                  startAt: startAt.toISOString(),
                  endAt: new Date(+startAt + 3600000).toISOString(),
                },
              ],
            },
          );
          await schedules.confirmProposal(teacher.principal, schedule.id, 1);
          await schedules.confirmProposal(learner.principal, schedule.id, 1);
        }
        await paths.finalize(
          { principal: teacher.principal, key: randomUUID() },
          path.id,
          1,
        );
        const sessions = await f.db.session.findMany({
          where: { pathId: path.id },
          orderBy: { id: "asc" },
        });
        return { teacher, learner, path, sessions, request };
      }
      async function accepted(ctx) {
        const row = await stop.request(
          ctx.teacher.principal,
          ctx.path.id,
          randomUUID(),
          "End by approved case decision",
        );
        return stop.respond(ctx.learner.principal, ctx.path.id, row.id, {
          expectedVersion: 1,
          accept: true,
        });
      }
      async function decision(ctx, row, split) {
        const review = await stop.review(reviewer, ctx.path.id, row.id);
        return {
          expectedVersion: row.version,
          expectedExecutionDigest: review.execution.digest,
          policyReference: "test-approved-policy-v1",
          reason: "Approved allocation for the isolated test case",
          allocations: review.execution.allocations.map((item) => ({
            allocationId: item.allocationId,
            ...split(item),
          })),
        };
      }
      const refundAll = () => ({
        refund: "100.00",
        counterpartyPayment: "0.00",
        platformFee: "0.00",
      });
      async function assertLots(userId) {
        const wallet = await f.db.creditWallet.findUniqueOrThrow({
          where: { userId },
        });
        const lots = await f.db.creditLot.findMany({ where: { userId } });
        assert.equal(
          lots.reduce((s, l) => s + l.available, 0n),
          wallet.availableCredit,
        );
        assert.equal(
          lots.reduce((s, l) => s + l.held, 0n),
          wallet.heldCredit,
        );
        await f.transactions.run((tx) => provenance.requireTracked(tx, wallet));
        return wallet;
      }

      await t.test(
        "cancellation applies once, preserves identity and does not release Held",
        async () => {
          const ctx = await agreement();
          const session = ctx.sessions[0];
          const row = await cancellations.request(
            ctx.teacher.principal,
            session.id,
            "cancel",
            {
              reason: "Agree to a makeup",
              expectedStartAt: session.startAt.toISOString(),
            },
          );
          const results = await Promise.all(
            [1, 2].map(() =>
              cancellations.respond(ctx.learner.principal, session.id, row.id, {
                expectedVersion: 1,
                accept: true,
              }),
            ),
          );
          assert.ok(results.every((result) => result.status === "APPLIED"));
          assert.equal(
            await f.db.session.count({ where: { pathId: ctx.path.id } }),
            1,
          );
          assert.equal(
            (
              await f.db.session.findUniqueOrThrow({
                where: { id: session.id },
              })
            ).status,
            "MAKEUP_REQUIRED",
          );
          assert.equal(
            (await assertLots(ctx.learner.user.id)).heldCredit,
            10000n,
          );
          await assert.rejects(() =>
            f.db.learningChangeRequest.update({
              where: { id: row.id },
              data: { reason: "Rewrite history" },
            }),
          );
        },
      );

      await t.test(
        "ONE_WAY: exact allocation, concurrent replay, source closure and reconciliation",
        async () => {
          const ctx = await agreement();
          const row = await accepted(ctx);
          const input = await decision(ctx, row, () => ({
            refund: "60.00",
            counterpartyPayment: "39.00",
            platformFee: "1.00",
          }));
          const results = await Promise.all(
            [1, 2].map(() =>
              stop.execute(reviewer, ctx.path.id, row.id, input),
            ),
          );
          assert.equal(results[0].operationId, results[1].operationId);
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            6000n,
          );
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            13900n,
          );
          assert.equal((await assertLots(ctx.learner.user.id)).heldCredit, 0n);
          assert.equal(
            (
              await f.db.learningRequest.findUniqueOrThrow({
                where: { id: ctx.request.id },
              })
            ).status,
            "CLOSED",
          );
          assert.equal(
            (
              await f.db.learningPath.findUniqueOrThrow({
                where: { id: ctx.path.id },
              })
            ).settledAt,
            null,
          );
          const snapshot = await previewLifecycle(f.client, {
            limit: 100,
            after: null,
          });
          assert.equal(
            snapshot.items.find((item) => item.requestId === ctx.request.id)
              .classification,
            "NO_CHANGE",
          );
          await assert.rejects(
            () =>
              stop.execute(reviewer, ctx.path.id, row.id, {
                ...input,
                reason: "Different decision",
              }),
            { message: "TERMINATION_DECISION_CONFLICT" },
          );
        },
      );

      await t.test(
        "TWO_WAY: distribute each payer's Held independently, with exact conservation",
        async () => {
          const ctx = await agreement(true);
          const row = await accepted(ctx);
          const input = await decision(ctx, row, (item) =>
            item.userId === ctx.teacher.user.id
              ? {
                  refund: "10.00",
                  counterpartyPayment: "9.00",
                  platformFee: "1.00",
                }
              : {
                  refund: "15.00",
                  counterpartyPayment: "4.00",
                  platformFee: "1.00",
                },
          );
          await stop.execute(reviewer, ctx.path.id, row.id, input);
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            9400n,
          );
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            10400n,
          );
          assert.equal(
            await f.db.session.count({
              where: { pathId: ctx.path.id, status: "CANCELLED" },
            }),
            2,
          );
          assert.equal(
            await f.db.heldCreditAllocation.count({
              where: { pathId: ctx.path.id, remainingHeld: { gt: 0n } },
            }),
            0,
          );
        },
      );

      await t.test(
        "audit failure rolls back balances, lots, ledger, sessions and source together",
        async () => {
          const ctx = await agreement();
          const row = await accepted(ctx);
          const input = await decision(ctx, row, refundAll);
          const original = mutableAudit.append;
          mutableAudit.append = (tx, entry) =>
            entry.after?.status === "APPLIED"
              ? Promise.reject(new Error("injected audit failure"))
              : original(tx, entry);
          try {
            await assert.rejects(
              () => stop.execute(reviewer, ctx.path.id, row.id, input),
              /injected audit failure/,
            );
          } finally {
            mutableAudit.append = original;
          }
          assert.equal(
            (await assertLots(ctx.learner.user.id)).heldCredit,
            10000n,
          );
          assert.equal(
            (
              await f.db.session.findUniqueOrThrow({
                where: { id: ctx.sessions[0].id },
              })
            ).status,
            "CONFIRMED",
          );
          assert.equal(
            (
              await f.db.learningRequest.findUniqueOrThrow({
                where: { id: ctx.request.id },
              })
            ).status,
            "MATCHED",
          );
          assert.equal(
            await f.db.creditOperation.count({
              where: {
                referenceId: ctx.path.id,
                operationType: "PATH_TERMINATION",
              },
            }),
            0,
          );
          await stop.execute(reviewer, ctx.path.id, row.id, input);
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            10000n,
          );
        },
      );

      await t.test(
        "policy, dispute, stale snapshot, unruled past sessions and invalid sums block all posting",
        async () => {
          const ctx = await agreement();
          const row = await accepted(ctx);
          const input = await decision(ctx, row, refundAll);
          values["learningPath.changeRequests"].terminationPolicyReference =
            null;
          await assert.rejects(
            () => stop.execute(reviewer, ctx.path.id, row.id, input),
            { message: "TERMINATION_POLICY_NOT_APPROVED" },
          );
          values["learningPath.changeRequests"].terminationPolicyReference =
            "test-approved-policy-v1";
          await f.db.reportCase.create({
            data: {
              reporterId: ctx.teacher.user.id,
              targetType: "SESSION",
              targetId: ctx.sessions[0].id,
              relatedPathId: ctx.path.id,
              relatedSessionId: ctx.sessions[0].id,
              reasonCode: "OTHER",
              description: "Test dispute",
              status: "OPEN",
              blocksSettlement: true,
            },
          });
          await assert.rejects(
            () => stop.execute(reviewer, ctx.path.id, row.id, input),
            { message: "TERMINATION_BLOCKED_BY_DISPUTE" },
          );
          await f.db.reportCase.updateMany({
            where: { relatedPathId: ctx.path.id },
            data: { status: "RESOLVED", blocksSettlement: false },
          });
          await assert.rejects(
            () =>
              stop.execute(reviewer, ctx.path.id, row.id, {
                ...input,
                allocations: input.allocations.map((item) => ({
                  ...item,
                  refund: "99.99",
                })),
              }),
            { message: "TERMINATION_ALLOCATION_MISMATCH" },
          );
          await f.db.session.update({
            where: { id: ctx.sessions[0].id },
            data: { status: "AWAITING_CONFIRMATION" },
          });
          await assert.rejects(
            () => stop.execute(reviewer, ctx.path.id, row.id, input),
            { message: "STALE_TERMINATION_EXECUTION" },
          );
          const refreshed = await decision(ctx, row, refundAll);
          await assert.rejects(
            () => stop.execute(reviewer, ctx.path.id, row.id, refreshed),
            { message: "TERMINATION_SESSION_RULING_REQUIRED" },
          );
          assert.equal(
            (await assertLots(ctx.learner.user.id)).heldCredit,
            10000n,
          );
          assert.equal(
            await f.db.creditOperation.count({
              where: {
                referenceId: ctx.path.id,
                operationType: "PATH_TERMINATION",
              },
            }),
            0,
          );
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
