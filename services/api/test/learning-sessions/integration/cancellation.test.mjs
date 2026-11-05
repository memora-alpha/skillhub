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
import { LearningSessionsService } from "../../../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { ReportsService } from "../../../dist/modules/reports/application/services/reports.service.js";

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
      const reports = new ReportsService(
        f.transactions,
        {},
        {},
        mutableAudit,
        {},
        {},
        configuration,
        cancellations,
      );
      const learningSessions = new LearningSessionsService(
        f.transactions,
        f.db,
        wallet,
        { applyPathCompletion: async () => {} },
        { evaluate: async () => {} },
        reports,
        configuration,
        { config: { enabled: false } },
        { now: () => new Date() },
        requests,
        requestPaths,
        mutableAudit,
      );

      async function agreement(twoWay = false, totalSessions = 1) {
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
            totalSessions,
            sessionOutline: Array.from({ length: totalSessions }, () => ({
              content: "One lesson",
            })),
          });
          await paths.confirmPlan(student.principal, plan.id, 1);
          plans.push({ plan, index, owner });
        }
        await paths.confirmAgreement(teacher.principal, path.id, 1);
        await paths.confirmAgreement(learner.principal, path.id, 1);
        for (const { plan, index, owner } of plans) {
          const startAt = new Date(
            Date.now() + (7 + index * totalSessions) * 86400000,
          );
          const schedule = await schedules.createProposal(
            owner.principal,
            plan.id,
            {
              expectedPlanVersion: 1,
              items: Array.from({ length: totalSessions }, (_, n) => ({
                sessionNo: n + 1,
                startAt: new Date(+startAt + n * 86400000).toISOString(),
                endAt: new Date(
                  +startAt + n * 86400000 + 3600000,
                ).toISOString(),
              })),
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
          const ctx = await agreement(false, 5);
          await f.db.session.updateMany({
            where: {
              id: { in: ctx.sessions.slice(0, 2).map((item) => item.id) },
            },
            data: { status: "COMPLETED" },
          });
          const row = await accepted(ctx);
          const input = await decision(ctx, row, () => ({
            refund: "60.00",
            counterpartyPayment: "38.40",
            platformFee: "1.60",
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
            13840n,
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
          await f.db.session.update({
            where: { id: ctx.sessions[0].id },
            data: { status: "COMPLETED" },
          });
          const row = await accepted(ctx);
          const input = await decision(ctx, row, (item) =>
            item.userId === ctx.teacher.user.id
              ? {
                  refund: "10.60",
                  counterpartyPayment: "9.00",
                  platformFee: "0.40",
                }
              : {
                  refund: "15.60",
                  counterpartyPayment: "4.00",
                  platformFee: "0.40",
                },
          );
          input.compensationReason =
            "Independent case ruling for each participant";
          await stop.execute(reviewer, ctx.path.id, row.id, input);
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            9460n,
          );
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            10460n,
          );
          assert.equal(
            await f.db.session.count({
              where: { pathId: ctx.path.id, status: "CANCELLED" },
            }),
            1,
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
        "session snapshot is immutable; arbitrary fees and compensation without a reason cannot post",
        async () => {
          const ctx = await agreement(true);
          const row = await accepted(ctx);
          const review = await stop.review(reviewer, ctx.path.id, row.id);
          assert.equal(review.execution.quote.allocations[0].refund, "20.00");
          const input = await decision(ctx, row, () => ({
            refund: "20.00",
            counterpartyPayment: "0.00",
            platformFee: "0.00",
          }));
          const held = await f.db.heldCreditAllocation.findMany({
            where: { pathId: ctx.path.id },
          });
          await assert.rejects(
            () =>
              f.db.heldCreditAllocation.update({
                where: { id: held[0].id },
                data: { sessionCreditSnapshot: { policy: "changed" } },
              }),
            /SESSION_CREDIT_SNAPSHOT_IMMUTABLE/,
          );
          await assert.rejects(
            () =>
              stop.execute(reviewer, ctx.path.id, row.id, {
                ...input,
                allocations: input.allocations.map((item) => ({
                  ...item,
                  refund: "19.00",
                  platformFee: "1.00",
                })),
              }),
            /TERMINATION_FORMULA_MISMATCH/,
          );
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).heldCredit,
            2000n,
          );
          const compensated = {
            ...input,
            allocations: input.allocations.map((item) => ({
              ...item,
              refund: "19.00",
              counterpartyPayment: "1.00",
            })),
          };
          await assert.rejects(
            () => stop.execute(reviewer, ctx.path.id, row.id, compensated),
            /TERMINATION_COMPENSATION_REASON_REQUIRED/,
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
          const originalAudit = mutableAudit.append;
          mutableAudit.append = (tx, entry) =>
            entry.after?.status === "APPLIED"
              ? Promise.reject(
                  new Error("injected session-credit audit failure"),
                )
              : originalAudit(tx, entry);
          try {
            await assert.rejects(
              () => stop.execute(reviewer, ctx.path.id, row.id, input),
              /injected session-credit audit failure/,
            );
          } finally {
            mutableAudit.append = originalAudit;
          }
          assert.equal(
            (await assertLots(ctx.learner.user.id)).heldCredit,
            2000n,
          );
          assert.ok(
            (
              await f.db.session.findMany({ where: { pathId: ctx.path.id } })
            ).every((item) => item.status === "CONFIRMED"),
          );
          const results = await Promise.all(
            [1, 2].map(() =>
              stop.execute(reviewer, ctx.path.id, row.id, input),
            ),
          );
          assert.equal(results[0].operationId, results[1].operationId);
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            10000n,
          );
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            10000n,
          );
        },
      );

      await t.test(
        "ONE_WAY remainder and fee floor settle exactly against original source lots",
        async () => {
          const ctx = await agreement(false, 3);
          const first = ctx.sessions.find(
            (item) => item.outlineSessionNo === 1,
          );
          await f.db.session.update({
            where: { id: first.id },
            data: { status: "COMPLETED" },
          });
          const row = await accepted(ctx);
          const quote = await stop.quote(ctx.learner.principal, ctx.path.id);
          assert.equal(quote.allocations[0].completedCredit, "33.34");
          assert.equal(quote.allocations[0].platformFee, "1.33");
          const input = await decision(ctx, row, () => ({
            refund: "66.66",
            counterpartyPayment: "32.01",
            platformFee: "1.33",
          }));
          await stop.execute(reviewer, ctx.path.id, row.id, input);
          assert.equal(
            (await assertLots(ctx.learner.user.id)).availableCredit,
            6666n,
          );
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            13201n,
          );
          assert.equal((await assertLots(ctx.learner.user.id)).heldCredit, 0n);
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
      await t.test(
        "personal quota serializes concurrent makeup acceptances and rolls back a failed audit",
        async () => {
          const ctx = await agreement(false, 6);
          const requestsForMakeup = await Promise.all(
            ctx.sessions.slice(0, 2).map((session) =>
              cancellations.request(
                ctx.teacher.principal,
                session.id,
                randomUUID(),
                {
                  reason: "Reserve one makeup",
                  expectedStartAt: session.startAt.toISOString(),
                },
              ),
            ),
          );
          const results = await Promise.allSettled(
            requestsForMakeup.map((row, i) =>
              cancellations.respond(
                ctx.learner.principal,
                ctx.sessions[i].id,
                row.id,
                { expectedVersion: 1, accept: true },
              ),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter(
              (r) =>
                r.status === "rejected" &&
                r.reason.message === "USER_MAKEUP_LIMIT_REACHED",
            ).length,
            1,
          );
          const attributed = await f.db.session.findMany({
            where: { pathId: ctx.path.id, makeupCount: 1 },
          });
          assert.deepEqual(attributed[0].makeupUserIds, [ctx.teacher.user.id]);
          assert.equal(
            await f.db.session.count({
              where: { pathId: ctx.path.id, makeupCount: 1 },
            }),
            1,
          );
          const fresh = await agreement();
          const row = await cancellations.request(
            fresh.teacher.principal,
            fresh.sessions[0].id,
            randomUUID(),
            {
              reason: "Rollback makeup grant",
              expectedStartAt: fresh.sessions[0].startAt.toISOString(),
            },
          );
          const append = mutableAudit.append;
          mutableAudit.append = async () => {
            throw new Error("POLICY_AUDIT_FAILURE");
          };
          try {
            await assert.rejects(
              () =>
                cancellations.respond(
                  fresh.learner.principal,
                  fresh.sessions[0].id,
                  row.id,
                  { expectedVersion: 1, accept: true },
                ),
              /POLICY_AUDIT_FAILURE/,
            );
          } finally {
            mutableAudit.append = append;
          }
          assert.equal(
            (
              await f.db.session.findUniqueOrThrow({
                where: { id: fresh.sessions[0].id },
              })
            ).makeupCount,
            0,
          );
          assert.equal(
            (
              await f.db.learningChangeRequest.findUniqueOrThrow({
                where: { id: row.id },
              })
            ).status,
            "PENDING",
          );
        },
      );

      await t.test(
        "TWO_WAY personal allowance spans both roles and never consumes the partner allowance",
        async () => {
          const ctx = await agreement(true, 3);
          const first = ctx.sessions[0];
          const second = ctx.sessions.find(
            (row) => row.planId !== first.planId,
          );
          const third = ctx.sessions.find(
            (row) => row.id !== first.id && row.id !== second.id,
          );
          async function requestBy(person, session, partner) {
            const row = await cancellations.request(
              person.principal,
              session.id,
              randomUUID(),
              {
                reason: "Request a personal makeup",
                expectedStartAt: session.startAt.toISOString(),
              },
            );
            return cancellations.respond(
              partner.principal,
              session.id,
              row.id,
              { expectedVersion: 1, accept: true },
            );
          }
          await requestBy(ctx.teacher, first, ctx.learner);
          await assert.rejects(
            () => requestBy(ctx.teacher, second, ctx.learner),
            { message: "USER_MAKEUP_LIMIT_REACHED" },
          );
          await requestBy(ctx.learner, third, ctx.teacher);
          const charged = await f.db.session.findMany({
            where: { pathId: ctx.path.id, makeupCount: 1 },
          });
          assert.equal(charged.length, 2);
          assert.equal(
            charged.filter((row) =>
              row.makeupUserIds.includes(ctx.teacher.user.id),
            ).length,
            1,
          );
          assert.equal(
            charged.filter((row) =>
              row.makeupUserIds.includes(ctx.learner.user.id),
            ).length,
            1,
          );
        },
      );

      await t.test(
        "reschedule confirmations count once, preserve the original anchor and enforce three applied changes",
        async () => {
          const ctx = await agreement();
          const session = ctx.sessions[0];
          assert.equal(+session.originalStartAt, +session.startAt);
          const history = await f.db.sessionScheduleHistory.findFirstOrThrow({
            where: { sessionId: session.id, supersededAt: null },
            include: { scheduleItemIdRecord: true },
          });
          const scheduleId = history.scheduleItemIdRecord.scheduleProposalId;
          for (let n = 1; n <= 3; n++) {
            const proposed = await schedules.proposeReschedule(
              ctx.teacher.principal,
              session.id,
              {
                expectedVersion: n,
                startAt: new Date(+session.startAt + n * 3600000).toISOString(),
                endAt: new Date(+session.endAt + n * 3600000).toISOString(),
              },
            );
            await Promise.all(
              [ctx.teacher, ctx.learner].map((person) =>
                schedules.confirmProposal(
                  person.principal,
                  scheduleId,
                  proposed.version,
                ),
              ),
            );
            await schedules.confirmProposal(
              ctx.learner.principal,
              scheduleId,
              proposed.version,
            );
            assert.equal(
              (
                await f.db.session.findUniqueOrThrow({
                  where: { id: session.id },
                })
              ).rescheduleCount,
              n,
            );
          }
          await assert.rejects(
            () =>
              schedules.proposeReschedule(ctx.teacher.principal, session.id, {
                expectedVersion: 4,
                startAt: new Date(+session.startAt + 4 * 3600000).toISOString(),
                endAt: new Date(+session.endAt + 4 * 3600000).toISOString(),
              }),
            { message: "SESSION_RESCHEDULE_LIMIT_REACHED" },
          );
          await assert.rejects(
            () =>
              f.db.session.update({
                where: { id: session.id },
                data: {
                  originalStartAt: new Date(+session.startAt + 86400000),
                },
              }),
            /SESSION_POLICY_HISTORY_IMMUTABLE/,
          );
          await assert.rejects(
            () =>
              f.db.session.update({
                where: { id: session.id },
                data: { rescheduleCount: 0 },
              }),
            /SESSION_POLICY_HISTORY_IMMUTABLE/,
          );
        },
      );

      async function markCompletedForSettlement(ctx) {
        const endedAt = new Date(Date.now() - 30 * 60000);
        await f.db.session.updateMany({
          where: { pathId: ctx.path.id },
          data: {
            startAt: new Date(+endedAt - 3600000),
            endAt: endedAt,
            status: "COMPLETED",
          },
        });
        await f.db.learningPath.update({
          where: { id: ctx.path.id },
          data: { status: "ACTIVE" },
        });
      }
      await t.test(
        "consent audit rollback, durable consent after financial rollback and exactly-once concurrent settlement",
        async () => {
          const ctx = await agreement();
          await markCompletedForSettlement(ctx);
          const append = mutableAudit.append;
          mutableAudit.append = async () => {
            throw new Error("CONSENT_AUDIT_FAILURE");
          };
          try {
            await assert.rejects(
              () =>
                learningSessions.approveImmediateSettlement(
                  ctx.teacher.principal,
                  ctx.path.id,
                  1,
                ),
              /CONSENT_AUDIT_FAILURE/,
            );
          } finally {
            mutableAudit.append = append;
          }
          assert.equal(
            (
              await f.db.learningPath.findUniqueOrThrow({
                where: { id: ctx.path.id },
              })
            ).participantASettlementApprovedAt,
            null,
          );
          assert.equal(
            (
              await learningSessions.approveImmediateSettlement(
                ctx.teacher.principal,
                ctx.path.id,
                1,
              )
            ).settlement.outcome,
            "WAITING",
          );
          const settle = wallet.settlePath.bind(wallet);
          wallet.settlePath = async (...args) => {
            await settle(...args);
            throw new Error("SETTLEMENT_AFTER_LEDGER_FAILURE");
          };
          try {
            assert.equal(
              (
                await learningSessions.approveImmediateSettlement(
                  ctx.learner.principal,
                  ctx.path.id,
                  1,
                )
              ).settlement.outcome,
              "RETRYING",
            );
          } finally {
            wallet.settlePath = settle;
          }
          const pending = await f.db.learningPath.findUniqueOrThrow({
            where: { id: ctx.path.id },
          });
          assert.ok(
            pending.participantASettlementApprovedAt &&
              pending.participantBSettlementApprovedAt,
          );
          assert.equal(pending.settledAt, null);
          assert.equal(
            (await assertLots(ctx.learner.user.id)).heldCredit,
            10000n,
          );
          await Promise.all([
            learningSessions.trySettleCompletedPath(ctx.path.id),
            learningSessions.approveImmediateSettlement(
              ctx.learner.principal,
              ctx.path.id,
              1,
            ),
            learningSessions.approveImmediateSettlement(
              ctx.teacher.principal,
              ctx.path.id,
              1,
            ),
          ]);
          const completed = await f.db.learningPath.findUniqueOrThrow({
            where: { id: ctx.path.id },
          });
          assert.ok(completed.settledAt);
          assert.equal((await assertLots(ctx.learner.user.id)).heldCredit, 0n);
          assert.equal(
            (await assertLots(ctx.teacher.user.id)).availableCredit,
            19600n,
          );
          const posting = completed.settlementOperationId;
          await learningSessions.approveImmediateSettlement(
            ctx.teacher.principal,
            ctx.path.id,
            1,
          );
          assert.equal(
            (
              await f.db.learningPath.findUniqueOrThrow({
                where: { id: ctx.path.id },
              })
            ).settlementOperationId,
            posting,
          );
        },
      );

      await t.test(
        "report and second financial consent serialize without releasing blocked Held",
        async () => {
          const ctx = await agreement();
          await markCompletedForSettlement(ctx);
          await learningSessions.approveImmediateSettlement(
            ctx.teacher.principal,
            ctx.path.id,
            1,
          );
          const results = await Promise.allSettled([
            reports.createSessionReport(
              ctx.teacher.principal,
              ctx.sessions[0].id,
              {
                reasonCode: "OTHER",
                description: "Review before releasing funds",
                evidenceFileIds: [],
              },
            ),
            learningSessions.approveImmediateSettlement(
              ctx.learner.principal,
              ctx.path.id,
              1,
            ),
          ]);
          assert.equal(results[0].status, "fulfilled");
          const path = await f.db.learningPath.findUniqueOrThrow({
            where: { id: ctx.path.id },
          });
          const report = await f.db.reportCase.findFirstOrThrow({
            where: { relatedPathId: ctx.path.id },
          });
          if (path.settledAt) {
            assert.equal(report.blocksSettlement, false);
            assert.equal(
              (await assertLots(ctx.learner.user.id)).heldCredit,
              0n,
            );
          } else {
            assert.equal(report.blocksSettlement, true);
            assert.equal(path.participantASettlementApprovedAt, null);
            assert.equal(path.participantBSettlementApprovedAt, null);
            assert.equal(
              (await assertLots(ctx.learner.user.id)).heldCredit,
              10000n,
            );
          }
        },
      );
    } finally {
      await f.dispose();
    }
  },
);
