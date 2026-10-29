import { fundedLearningParticipants } from "../learning-platform/persistence-fixtures.mjs";
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createSkillFixture } from "../skills/helpers.mjs";
import { LearningPathsService } from "../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { LearningSessionsService } from "../../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { LearningRequestPathReader } from "../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { LearningRequestAccessService } from "../../dist/modules/learning-requests/application/services/learning-request-access.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { CancelLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.js";
import { ConversationMembershipReader } from "../../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { SchedulingService } from "../../dist/modules/scheduling/application/services/scheduling.service.js";
import { CreditLedgerAdapter } from "../../dist/modules/credit/application/services/credit-ledger.adapter.js";
import { CreditLedgerService } from "../../dist/modules/credit/application/services/credit-ledger.service.js";
import { CreditWalletReader } from "../../dist/modules/credit/application/services/credit-wallet.reader.js";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { ReportsService } from "../../dist/modules/reports/application/services/reports.service.js";
import { ReviewsService } from "../../dist/modules/reviews/application/services/reviews.service.js";
import { ReputationService } from "../../dist/modules/reputation/application/services/reputation.service.js";
import { AchievementsService } from "../../dist/modules/reputation/application/services/achievements.service.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { defaultConfiguration } from "../learning-platform/fixtures.mjs";
import { previewLifecycle } from "../../scripts/reconcile-learning-requests.mjs";

const skip =
  !process.env.TEST_DATABASE_URL &&
  "TEST_DATABASE_URL required; never use the application database";
const code = (name) => (error) =>
  error.getStatus?.() === 409 && error.message === name;

test(
  "PostgreSQL: review-versus-settlement replay has no deadlock",
  { skip },
  async () => {
    const f = await fixture();
    const deadlocks = observeDeadlocks(f.db);
    const observed = deadlocks.runner;
    const gate = requestGate(observed, "learning_paths");
    try {
      const pathId = await f.draft();
      await f.finalize(pathId);
      await f.complete(pathId);
      await f.sessions.settlePath(f.learner.principal, pathId);
      const reviews = new ReviewsService(
        gate.runner,
        new ReputationService(f.audit),
        new AchievementsService(gate.runner),
      );
      const first = outcome(
        reviews.create(f.learner.principal, pathId, {
          rating: 5,
          comment: "Completed learning",
        }),
      );
      await gate.entered;
      const observer = observeTransaction(observed);
      const second = outcome(
        f.makeSessions(observer.runner).settlePath(f.teacher.principal, pathId),
      );
      await waitForBlock(f.client, await observer.started);
      gate.release();
      const [a, b] = await Promise.all([first, second]);
      assert.equal(deadlocks.count, 0);
      assert.equal(a.error, undefined);
      assert.equal(b.error, undefined);
      assert.equal(await f.db.review.count(), 1);
      assert.equal(await f.db.creditOperation.count(), 2);
    } finally {
      gate.release();
      await f.dispose();
    }
  },
);

function observeDeadlocks(db) {
  let count = 0;
  const runner = new TransactionRunner({
    $transaction: async (...args) => {
      try {
        return await db.$transaction(...args);
      } catch (error) {
        if (JSON.stringify(error).includes("40P01")) count++;
        throw error;
      }
    },
  });
  return {
    runner,
    get count() {
      return count;
    },
  };
}

async function fixture({ direct = false } = {}) {
  assert.ok(process.env.TEST_DATABASE_URL);
  const f = await createSkillFixture();
  try {
    const { teacher, learner, skill } = await fundedLearningParticipants(
      f,
      100000n,
      "Lifecycle integration",
    );
    const request = await f.db.learningRequest.create({
      data: {
        ownerId: learner.user.id,
        skillId: skill.id,
        title: "Lifecycle integration request",
        description: "A learning request for transactional lifecycle tests",
        learningGoal: "Complete a learning agreement",
        currentLevel: "BEGINNER",
        status: "NEGOTIATING",
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const target = direct
      ? await f.db.sharingSkill.create({
          data: {
            userId: learner.user.id,
            skillId: skill.id,
            level: "BEGINNER",
            description: "A direct-search integration offering",
            verificationStatus: "UNVERIFIED",
            isVisible: true,
          },
        })
      : null;
    const proposal = await f.db.proposal.create({
      data: {
        requestId: direct ? null : request.id,
        sourceType: direct ? "DIRECT_SEARCH" : "LEARNING_REQUEST",
        targetSharingSkillId: target?.id,
        proposerId: teacher.user.id,
        recipientId: learner.user.id,
        skillId: skill.id,
        message: "Lifecycle proposal",
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const conversation = await f.db.conversation.create({
      data: {
        requestId: direct ? null : request.id,
        proposalId: proposal.id,
        participantAId: teacher.user.id,
        participantBId: learner.user.id,
      },
    });
    await f.db.$transaction((tx) => seedPathFeePolicies(tx));
    const repository = new PrismaLearningRequestRepository(f.db);
    const requests = new LearningRequestLifecycleService(repository);
    const reader = new LearningRequestPathReader();
    const wallet = new CreditLedgerAdapter(
      new CreditWalletReader(),
      new CreditLedgerService(),
    );
    const configuration = {
      getSnapshot: async (keys) => ({
        values: Object.fromEntries(
          keys.map((key) => [key, defaultConfiguration[key]]),
        ),
      }),
    };
    const makePaths = (runner = f.transactions, lifecycle = requests) =>
      new LearningPathsService(
        runner,
        new ConversationMembershipReader(),
        wallet,
        configuration,
        new IdempotencyService(runner),
        lifecycle,
        reader,
      );
    let sessionNow = null;
    const sessionRunner = {
      run: (work, options) =>
        f.transactions.run(
          (tx) =>
            work(
              new Proxy(tx, {
                get(target, property) {
                  if (property !== "$queryRaw") return target[property];
                  return (...args) =>
                    sessionNow &&
                    Array.isArray(args[0]) &&
                    args[0].join("").includes("CURRENT_TIMESTAMP")
                      ? [{ now: sessionNow }]
                      : target.$queryRaw(...args);
                },
              }),
            ),
          options,
        ),
    };
    const makeSessions = (runner = sessionRunner, lifecycle = requests) =>
      new LearningSessionsService(
        runner,
        f.db,
        wallet,
        new ReputationService(f.audit),
        new AchievementsService(runner),
        new ReportsService(runner, {}, {}, f.audit),
        configuration,
        { config: { enabled: false } },
        { now: () => new Date() },
        lifecycle,
        reader,
      );
    const makeCancel = (runner = f.transactions) =>
      new CancelLearningRequestUseCase(
        runner,
        new LearningRequestAccessService(f.identity.sessions),
        repository,
        reader,
        f.sharing,
      );
    const paths = makePaths(),
      sessions = makeSessions();
    const schedules = new SchedulingService(
      f.transactions,
      f.audit,
      configuration,
    );
    async function draft(day = 7, exchangeType = "ONE_WAY") {
      const path = await paths.create(learner.principal, {
        conversationId: conversation.id,
        exchangeType,
        teacherId: teacher.user.id,
        learnerId: learner.user.id,
        negotiatedCredit: "100.00",
        totalCreditPerUser: "20.00",
      });
      const parties =
        exchangeType === "TWO_WAY"
          ? [
              [teacher, learner],
              [learner, teacher],
            ]
          : [[teacher, learner]];
      for (const [index, [t, l]] of parties.entries()) {
        const plan = await paths.addPlan(t.principal, path.id, {
          skillId: skill.id,
          learningGoal: "A meaningful goal",
          totalSessions: 1,
          sessionOutline: [{ content: "One session" }],
        });
        await paths.confirmPlan(l.principal, plan.id, 1);
        // Scheduling requires all plans and the agreement confirmed, so create schedules below.
        parties[index].push(plan);
      }
      await paths.confirmAgreement(teacher.principal, path.id, 1);
      await paths.confirmAgreement(learner.principal, path.id, 1);
      for (const [index, [t, , plan]] of parties.entries()) {
        const start = new Date(Date.now() + (day + index) * 86400000);
        const schedule = await schedules.createProposal(t.principal, plan.id, {
          expectedPlanVersion: 1,
          items: [
            {
              sessionNo: 1,
              startAt: start.toISOString(),
              endAt: new Date(start.getTime() + 3600000).toISOString(),
            },
          ],
        });
        await schedules.confirmProposal(teacher.principal, schedule.id, 1);
        await schedules.confirmProposal(learner.principal, schedule.id, 1);
      }
      return path.id;
    }
    const finalize = (pathId, service = paths, key = randomUUID()) =>
      service.finalize({ principal: teacher.principal, key }, pathId, 1);
    const current = () =>
      f.db.learningRequest.findUniqueOrThrow({ where: { id: request.id } });
    const cancel = async (service = makeCancel()) =>
      service.execute(learner.principal, request.id, {
        expectedVersion: (await current()).version,
      });
    async function complete(pathId) {
      // Advance only this transaction's clock; keep the immutable applied schedule/history intact.
      sessionNow = new Date(Date.now() + 30 * 86400000);
      for (const session of await f.db.session.findMany({
        where: { pathId },
      })) {
        await sessions.complete(teacher.principal, session.id, "Completed");
        await sessions.complete(learner.principal, session.id, "Completed");
      }
    }
    return {
      ...f,
      teacher,
      learner,
      request,
      proposal,
      conversation,
      paths,
      sessions,
      requests,
      reader,
      schedules,
      makePaths,
      makeSessions,
      makeCancel,
      draft,
      finalize,
      cancel,
      current,
      complete,
    };
  } catch (error) {
    await f.dispose();
    throw error;
  }
}

function requestGate(transactions, table = "learning_requests") {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  let gated = false;
  return {
    entered: entered.promise,
    release: () => release.resolve(),
    runner: {
      run: (work, options) =>
        transactions.run(
          (tx) =>
            work(
              new Proxy(tx, {
                get(target, property) {
                  if (property !== "$queryRaw") return target[property];
                  return async (...args) => {
                    const result = await target.$queryRaw(...args);
                    if (
                      !gated &&
                      Array.isArray(args[0]) &&
                      args[0].join("").includes("FROM " + table) &&
                      args[0].join("").includes("FOR UPDATE")
                    ) {
                      gated = true;
                      entered.resolve();
                      await release.promise;
                    }
                    return result;
                  };
                },
              }),
            ),
          options,
        ),
    },
  };
}

function observeTransaction(transactions) {
  const started = Promise.withResolvers();
  return {
    started: started.promise,
    runner: {
      run: (work, options) =>
        transactions.run(async (tx) => {
          const [row] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          started.resolve(row.pid);
          return work(tx);
        }, options),
    },
  };
}

async function waitForBlock(client, pid) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const { rows } = await client.query(
      "SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked",
      [pid],
    );
    if (rows[0].blocked) return;
  }
  assert.fail("Contending transaction never reached a real PostgreSQL lock");
}

const outcome = (promise) =>
  promise.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );

test(
  "PostgreSQL: cancel-vs-finalize serializes in either order without orphan Hold/Session",
  { skip },
  async () => {
    for (const winner of ["cancel", "finalize"]) {
      const f = await fixture();
      const gate = requestGate(f.transactions);
      try {
        const pathId = await f.draft();
        const first = outcome(
          winner === "cancel"
            ? f.cancel(f.makeCancel(gate.runner))
            : f.finalize(pathId, f.makePaths(gate.runner)),
        );
        await gate.entered;
        const observer = observeTransaction(f.transactions);
        const second = outcome(
          winner === "cancel"
            ? f.finalize(pathId, f.makePaths(observer.runner))
            : f.cancel(f.makeCancel(observer.runner)),
        );
        await waitForBlock(f.client, await observer.started);
        gate.release();
        const [a, b] = await Promise.all([first, second]);
        assert.equal(a.error, undefined);
        assert.ok(b.error?.getStatus?.() === 409);
        assert.equal(
          (await f.current()).status,
          winner === "cancel" ? "CANCELLED" : "MATCHED",
        );
        assert.equal(
          await f.db.creditOperation.count(),
          winner === "cancel" ? 0 : 1,
        );
        assert.equal(await f.db.session.count(), winner === "cancel" ? 0 : 1);
        assert.equal(await f.db.proposal.count(), 1);
        assert.equal(await f.db.conversation.count(), 1);
      } finally {
        gate.release();
        await f.dispose();
      }
    }
  },
);

test(
  "PostgreSQL: competing Path finalizations choose one winner, preserve drafts and replay once",
  { skip },
  async () => {
    const f = await fixture(),
      gate = requestGate(f.transactions);
    try {
      const firstId = await f.draft(7),
        secondId = await f.draft(10);
      const first = outcome(
        f.finalize(firstId, f.makePaths(gate.runner), "same-key"),
      );
      await gate.entered;
      const observer = observeTransaction(f.transactions);
      const second = outcome(
        f.finalize(secondId, f.makePaths(observer.runner)),
      );
      await waitForBlock(f.client, await observer.started);
      gate.release();
      const [a, b] = await Promise.all([first, second]);
      assert.equal(a.error, undefined);
      assert.ok(code("REQUEST_ALREADY_MATCHED")(b.error));
      const version = (await f.current()).version;
      await f.finalize(firstId, f.paths, "same-key");
      await f.finalize(firstId);
      assert.equal((await f.current()).version, version);
      assert.equal(await f.db.creditOperation.count(), 1);
      assert.equal(await f.db.session.count(), 1);
      assert.equal(
        (await f.db.learningPath.findUniqueOrThrow({ where: { id: secondId } }))
          .lockedVersion,
        null,
      );
    } finally {
      gate.release();
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: failures after MATCHED and after settlement/CLOSED roll back all owner writes",
  { skip },
  async () => {
    const f = await fixture();
    try {
      const pathId = await f.draft();
      const fail = Object.create(f.requests);
      fail.markMatched = async (...args) => {
        await f.requests.markMatched(...args);
        throw new Error("after matched");
      };
      const initial = await f.current();
      await assert.rejects(
        f.finalize(pathId, f.makePaths(f.transactions, fail)),
        /after matched/,
      );
      assert.deepEqual(await f.current(), initial);
      assert.equal(await f.db.creditOperation.count(), 0);
      assert.equal(await f.db.session.count(), 0);
      assert.equal(await f.db.heldCreditAllocation.count(), 0);
      await f.finalize(pathId);
      await f.complete(pathId);
      const models = [
        "learningRequest",
        "learningPath",
        "session",
        "creditWallet",
        "heldCreditAllocation",
        "creditOperation",
        "creditTransaction",
        "outboxEvent",
        "auditLog",
        "userLearnedSkill",
        "reputationHistory",
        "userAchievement",
        "user",
      ];
      const snapshot = () =>
        Promise.all(models.map((model) => f.db[model].findMany()));
      const before = await snapshot();
      fail.markClosed = async (...args) => {
        await f.requests.markClosed(...args);
        throw new Error("after closed");
      };
      await assert.rejects(
        f.makeSessions(undefined, fail).settlePath(f.learner.principal, pathId),
        /after closed/,
      );
      assert.deepEqual(await snapshot(), before);
      await f.sessions.trySettleCompletedPath(pathId);
      assert.equal((await f.current()).status, "CLOSED");
      const operations = await f.db.creditOperation.count();
      await f.sessions.settlePath(f.teacher.principal, pathId);
      await f.sessions.trySettleCompletedPath(pathId);
      assert.equal(await f.db.creditOperation.count(), operations);
      assert.equal((await f.current()).version, initial.version + 2);
    } finally {
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: preview reads a stable snapshot, proposes legacy repairs, never writes and paginates",
  { skip },
  async () => {
    const f = await fixture();
    try {
      const pathId = await f.draft();
      await f.finalize(pathId);
      // Simulate the pre-fix Request status only in the throwaway schema.
      await f.db.learningRequest.update({
        where: { id: f.request.id },
        data: { status: "NEGOTIATING" },
      });
      const models = [
        "learningRequest",
        "learningPath",
        "creditWallet",
        "creditTransaction",
        "creditOperation",
        "auditLog",
        "outboxEvent",
      ];
      const snapshot = () =>
        Promise.all(models.map((model) => f.db[model].findMany()));
      const before = await snapshot();
      const report = await previewLifecycle(f.client, {
        limit: 200,
        after: null,
      });
      assert.equal(report.items[0].classification, "NEEDS_REPAIR");
      const cliUrl = new URL(process.env.TEST_DATABASE_URL);
      cliUrl.searchParams.set(
        "options",
        `${cliUrl.searchParams.get("options") ?? ""} -c search_path=${f.schema}`.trim(),
      );
      const cli = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../../scripts/reconcile-learning-requests.mjs",
              import.meta.url,
            ),
          ),
          "--limit",
          "200",
        ],
        {
          encoding: "utf8",
          timeout: 20000,
          env: {
            ...process.env,
            LEARNING_REQUEST_RECONCILIATION_DATABASE_URL: cliUrl.toString(),
          },
        },
      );
      assert.equal(cli.status, 0, cli.stderr);
      assert.equal(JSON.parse(cli.stdout).mode, "dry-run");
      assert.equal(
        JSON.parse(cli.stdout).items[0].classification,
        "NEEDS_REPAIR",
      );
      if (cliUrl.password)
        assert.equal(cli.stdout.includes(cliUrl.password), false);
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(report.items[0].proposedTransitions, ["MATCHED"]);
      assert.deepEqual(await snapshot(), before);
      await f.client.query("SET ROLE pg_read_all_data");
      try {
        assert.equal(
          (await previewLifecycle(f.client, { limit: 200, after: null }))
            .items[0].classification,
          "NEEDS_REPAIR",
        );
      } finally {
        await f.client.query("RESET ROLE");
      }
      await f.db.learningRequest.update({
        where: { id: f.request.id },
        data: { status: "MATCHED" },
      });
      await f.complete(pathId);
      await f.sessions.settlePath(f.learner.principal, pathId);
      await f.db.learningRequest.update({
        where: { id: f.request.id },
        data: { status: "NEGOTIATING" },
      });
      const closed = await previewLifecycle(f.client, {
        limit: 200,
        after: null,
      });
      assert.deepEqual(closed.items[0].proposedTransitions, [
        "MATCHED",
        "CLOSED",
      ]);
      const incompleteLedger = {
        query: async (...args) => {
          const result = await f.client.query(...args);
          return typeof args[0] === "string" &&
            args[0].includes("FROM credit_transactions")
            ? {
                ...result,
                rows: result.rows.filter((r) => r.type !== "TEACHING_EARNING"),
              }
            : result;
        },
      };
      assert.equal(
        (await previewLifecycle(incompleteLedger, { limit: 200, after: null }))
          .items[0].classification,
        "MANUAL_REVIEW",
      );
      await f.db.learningRequest.create({
        data: {
          ownerId: f.learner.user.id,
          skillId: f.request.skillId,
          title: "Another request",
          description: "Another isolated learning request",
          learningGoal: "A suitable learning goal",
          currentLevel: "BEGINNER",
          status: "DRAFT",
        },
      });
      const page = await previewLifecycle(f.client, { limit: 1, after: null });
      assert.ok(page.nextCursor);
      const next = await previewLifecycle(f.client, {
        limit: 1,
        after: page.nextCursor,
      });
      assert.equal(next.nextCursor, null);
      assert.notEqual(page.items[0].requestId, next.items[0].requestId);
    } finally {
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: edit-versus-finalize never inverts participant FK locks",
  { skip },
  async () => {
    const f = await fixture();
    const deadlocks = observeDeadlocks(f.db);
    const observed = deadlocks.runner;
    const gate = requestGate(observed, "learning_paths");
    try {
      const pathId = await f.draft();
      const edit = outcome(
        f.makePaths(gate.runner).reviseAgreement(f.learner.principal, pathId, {
          expectedVersion: 1,
          exchangeType: "ONE_WAY",
          teacherId: f.teacher.user.id,
          learnerId: f.learner.user.id,
          negotiatedCredit: "150.00",
        }),
      );
      await gate.entered;
      const observer = observeTransaction(observed);
      const finalize = outcome(
        f.finalize(pathId, f.makePaths(observer.runner)),
      );
      await waitForBlock(f.client, await observer.started);
      gate.release();
      const [a, b] = await Promise.all([edit, finalize]);
      assert.equal(
        deadlocks.count,
        0,
        "Participant locks must precede Path, including user FK KEY SHARE acquisitions",
      );
      assert.equal(a.error, undefined);
      assert.equal(b.error?.getStatus?.(), 409);
      assert.equal(await f.db.creditOperation.count(), 0);
      assert.equal((await f.current()).status, "NEGOTIATING");
    } finally {
      gate.release();
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: preview never treats a LOCKED schedule with null appliedVersion as uncommitted",
  { skip },
  async () => {
    const f = await fixture();
    try {
      const pathId = await f.draft();
      const schedule = await f.db.scheduleProposal.findFirstOrThrow({
        where: { pathId },
      });
      await f.db.scheduleProposal.update({
        where: { id: schedule.id },
        data: { status: "LOCKED", appliedVersion: null },
      });
      await assert.rejects(f.cancel(), code("REQUEST_LOCKED"));
      const report = await previewLifecycle(f.client, {
        limit: 200,
        after: null,
      });
      assert.equal(report.items[0].classification, "MANUAL_REVIEW");
      assert.equal(report.items[0].evidence.committedPathCount, 1);
    } finally {
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: preview validates applied schedule versions and Session history",
  { skip },
  async () => {
    const f = await fixture();
    try {
      const pathId = await f.draft();
      await f.finalize(pathId);
      await f.db.learningRequest.update({
        where: { id: f.request.id },
        data: { status: "NEGOTIATING" },
      });
      const schedule = await f.db.scheduleProposal.findFirstOrThrow({
        where: { pathId },
      });
      await f.db.scheduleProposal.update({
        where: { id: schedule.id },
        data: { currentVersion: 99, appliedVersion: 99 },
      });
      assert.equal(
        (await previewLifecycle(f.client, { limit: 200, after: null })).items[0]
          .classification,
        "MANUAL_REVIEW",
      );
      await f.db.scheduleProposal.update({
        where: { id: schedule.id },
        data: { currentVersion: 1, appliedVersion: 1 },
      });
      await f.db.sessionScheduleHistory.deleteMany();
      assert.equal(
        (await previewLifecycle(f.client, { limit: 200, after: null })).items[0]
          .classification,
        "MANUAL_REVIEW",
      );
    } finally {
      await f.dispose();
    }
  },
);

test(
  "PostgreSQL: TWO_WAY completion and direct exchange preserve lifecycle boundaries",
  { skip },
  async () => {
    for (const direct of [false, true]) {
      const f = await fixture({ direct });
      try {
        const initial = await f.current();
        const pathId = await f.draft(7, "TWO_WAY");
        await f.finalize(pathId);
        if (!direct) {
          await f.db.learningPath.update({
            where: { id: pathId },
            data: { status: "CONFIRMED" },
          });
          await f.db.learningRequest.update({
            where: { id: f.request.id },
            data: { status: "NEGOTIATING" },
          });
          await assert.rejects(f.cancel(), code("REQUEST_LOCKED"));
          await f.db.learningPath.update({
            where: { id: pathId },
            data: { status: "SCHEDULED" },
          });
          await f.db.learningRequest.update({
            where: { id: f.request.id },
            data: { status: "MATCHED" },
          });
        }
        await f.complete(pathId);
        await f.sessions.settlePath(f.learner.principal, pathId);
        if (direct) assert.deepEqual(await f.current(), initial);
        else assert.equal((await f.current()).status, "CLOSED");
        for (const account of [f.teacher, f.learner]) {
          const wallet = await f.db.creditWallet.findUniqueOrThrow({
            where: { userId: account.user.id },
          });
          assert.deepEqual(
            [wallet.availableCredit, wallet.heldCredit],
            [99920n, 0n],
          );
        }
      } finally {
        await f.dispose();
      }
    }
  },
);

test(
  "PostgreSQL: preview preserves effective schedules while reschedule confirmation is pending",
  { skip },
  async () => {
    const f = await fixture();
    try {
      const pathId = await f.draft();
      await f.finalize(pathId);
      const session = await f.db.session.findFirstOrThrow({
        where: { pathId },
      });
      const proposal = await f.schedules.proposeReschedule(
        f.learner.principal,
        session.id,
        {
          expectedVersion: 1,
          startAt: new Date(session.startAt.getTime() + 86400000).toISOString(),
          endAt: new Date(session.endAt.getTime() + 86400000).toISOString(),
        },
      );
      assert.equal(
        (await previewLifecycle(f.client, { limit: 200, after: null })).items[0]
          .classification,
        "NO_CHANGE",
      );
      await f.schedules.confirmProposal(f.teacher.principal, proposal.id, 2);
      assert.equal(
        (await previewLifecycle(f.client, { limit: 200, after: null })).items[0]
          .classification,
        "NO_CHANGE",
      );
      await f.schedules.confirmProposal(f.learner.principal, proposal.id, 2);
      assert.equal(
        (await previewLifecycle(f.client, { limit: 200, after: null })).items[0]
          .classification,
        "NO_CHANGE",
      );
    } finally {
      await f.dispose();
    }
  },
);
