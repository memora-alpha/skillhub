import { fundedLearningParticipants } from "../../learning-platform/persistence-fixtures.mjs";
import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { createSkillFixture } from "../../skills/helpers.mjs";
import { LearningPathsService } from "../../../dist/modules/learning-paths/application/services/learning-paths.service.js";
import { SchedulingService } from "../../../dist/modules/scheduling/application/services/scheduling.service.js";
import { LearningSessionsService } from "../../../dist/modules/learning-sessions/application/services/learning-sessions.service.js";
import { ConversationMembershipReader } from "../../../dist/modules/conversations/application/services/conversation-membership.reader.js";
import { CreditLedgerAdapter } from "../../../dist/modules/credit/application/services/credit-ledger.adapter.js";
import { CreditLedgerService } from "../../../dist/modules/credit/application/services/credit-ledger.service.js";
import { CreditWalletReader } from "../../../dist/modules/credit/application/services/credit-wallet.reader.js";
import { seedPathFeePolicies } from "../../../dist/modules/credit/application/seed-fee-policies.js";
import { ReportsService } from "../../../dist/modules/reports/application/services/reports.service.js";
import { LearningRequestLifecycleService } from "../../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { PrismaLearningRequestRepository } from "../../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { LearningRequestPathReader } from "../../../dist/modules/learning-paths/application/services/learning-request-path.reader.js";
import { LiveKitService } from "../../../dist/modules/learning-sessions/infrastructure/livekit/livekit.service.js";
import { defaultConfiguration } from "../../learning-platform/fixtures.mjs";

test(
  "PostgreSQL: token/confirm races, receipt rollback and stale observation fencing",
  { skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL required" },
  async () => {
    // Guard before the shared harness, whose older consumers allow DATABASE_URL fallback.
    assert.ok(process.env.TEST_DATABASE_URL);
    const f = await createSkillFixture();
    try {
      const { teacher, learner, skill } = await fundedLearningParticipants(
        f,
        10000n,
        "Session test",
      );
      const request = await f.db.learningRequest.create({
        data: {
          ownerId: learner.user.id,
          skillId: skill.id,
          title: "Session fixture",
          description: "A learning request for a session integration test",
          learningGoal: "A test goal",
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
          message: "A session proposal",
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
      await f.db.$transaction((tx) => seedPathFeePolicies(tx));
      const configuration = {
        getSnapshot: async (keys) => ({
          values: Object.fromEntries(
            keys.map((key) => [
              key,
              key === "livekit.joinWindow"
                ? { earlyMinutes: 10, lateMinutes: 10 }
                : defaultConfiguration[key],
            ]),
          ),
        }),
      };
      const wallet = new CreditLedgerAdapter(
        new CreditWalletReader(),
        new CreditLedgerService(),
      );
      const paths = new LearningPathsService(
        f.transactions,
        new ConversationMembershipReader(),
        wallet,
        configuration,
        f.commands,
        new LearningRequestLifecycleService(
          new PrismaLearningRequestRepository(f.db),
        ),
        new LearningRequestPathReader(),
      );
      const schedules = new SchedulingService(
        f.transactions,
        f.audit,
        configuration,
      );
      const livekit = new LiveKitService(
        new ConfigService({
          LIVEKIT_URL: "wss://test.livekit.cloud",
          LIVEKIT_API_KEY: "test-key",
          LIVEKIT_API_SECRET: "test-secret-integration",
        }),
      );
      const reports = new ReportsService(f.transactions, {}, {}, f.audit);
      const sessions = new LearningSessionsService(
        f.transactions,
        f.db,
        wallet,
        { applyPathCompletion: async () => {} },
        { evaluate: async () => {} },
        reports,
        configuration,
        livekit,
        { now: () => new Date() },
        new LearningRequestLifecycleService(
          new PrismaLearningRequestRepository(f.db),
        ),
        new LearningRequestPathReader(),
      );
      const path = await paths.create(learner.principal, {
        conversationId: conversation.id,
        exchangeType: "ONE_WAY",
        teacherId: teacher.user.id,
        learnerId: learner.user.id,
        negotiatedCredit: "20.00",
      });
      const plan = await paths.addPlan(teacher.principal, path.id, {
        skillId: skill.id,
        learningGoal: "A useful integration goal",
        totalSessions: 1,
        sessionOutline: [{ content: "One session" }],
      });
      await paths.confirmPlan(learner.principal, plan.id, 1);
      await paths.confirmAgreement(teacher.principal, path.id, 1);
      await paths.confirmAgreement(learner.principal, path.id, 1);
      const future = Date.now() + 7 * 86400000;
      const schedule = await schedules.createProposal(
        teacher.principal,
        plan.id,
        {
          expectedPlanVersion: 1,
          items: [
            {
              sessionNo: 1,
              startAt: new Date(future).toISOString(),
              endAt: new Date(future + 3600000).toISOString(),
            },
          ],
        },
      );
      await schedules.confirmProposal(teacher.principal, schedule.id, 1);
      await schedules.confirmProposal(learner.principal, schedule.id, 1);
      await paths.finalize(
        { principal: teacher.principal, key: randomUUID() },
        path.id,
        1,
      );
      let session = await f.db.session.findFirstOrThrow({
        where: { pathId: path.id },
      });
      const now = Date.now();
      session = await f.db.session.update({
        where: { id: session.id },
        data: {
          startAt: new Date(now - 60000),
          endAt: new Date(now + 3540000),
        },
      });
      const tokens = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          sessions.issueLiveKitToken(
            i % 2 ? teacher.principal : learner.principal,
            session.id,
          ),
        ),
      );
      assert.equal(new Set(tokens.map((token) => token.roomName)).size, 1);
      assert.equal(
        new Set(tokens.map((token) => token.participantIdentity)).size,
        2,
      );
      session = await f.db.session.findUniqueOrThrow({
        where: { id: session.id },
      });

      const eventId = randomUUID();
      const event = {
        id: eventId,
        event: "participant_joined",
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        room: { name: session.roomName, sid: "RM_pg" },
        participant: { identity: `${session.id}:${teacher.user.id}` },
      };
      const futureEvent = {
        ...event,
        id: randomUUID(),
        createdAt: event.createdAt + 60n,
      };
      await assert.rejects(
        () =>
          f.consumer.processOnce(
            "livekit.session-lifecycle",
            futureEvent.id,
            (tx) => sessions.applyLiveKitActivity(tx, futureEvent),
          ),
        { message: "LIVEKIT_EVENT_NOT_YET_CURRENT" },
      );
      assert.equal(
        await f.db.outboxConsumerReceipt.count({
          where: { eventId: futureEvent.id },
        }),
        0,
      );
      await assert.rejects(
        () =>
          f.consumer.processOnce(
            "livekit.session-lifecycle",
            eventId,
            async (tx) => {
              await sessions.applyLiveKitActivity(tx, event);
              throw new Error("injected-rollback");
            },
          ),
        /injected-rollback/,
      );
      assert.equal(
        await f.db.outboxConsumerReceipt.count({ where: { eventId } }),
        0,
      );
      assert.equal(
        (await f.db.session.findUniqueOrThrow({ where: { id: session.id } }))
          .status,
        "CONFIRMED",
      );
      const duplicate = await Promise.all(
        [1, 2].map(() =>
          f.consumer.processOnce("livekit.session-lifecycle", eventId, (tx) =>
            sessions.applyLiveKitActivity(tx, event),
          ),
        ),
      );
      assert.equal(duplicate.filter((result) => result.processed).length, 1);

      const expected = session;
      const endedAt = new Date(Date.now() - 60000);
      await f.db.session.update({
        where: { id: session.id },
        data: {
          startAt: new Date(+endedAt - 3600000),
          endAt: endedAt,
          status: "CONFIRMED",
        },
      });
      await sessions.advanceLifecycle(expected, {
        roomSid: "RM_stale",
        identities: [`${session.id}:${teacher.user.id}`],
      });
      assert.notEqual(
        (await f.db.session.findUniqueOrThrow({ where: { id: session.id } }))
          .providerRoomId,
        "RM_stale",
      );
      await Promise.all([
        sessions.complete(teacher.principal, session.id, "first"),
        sessions.complete(learner.principal, session.id, "learnt"),
      ]);
      const confirmed = await f.db.session.findUniqueOrThrow({
        where: { id: session.id },
      });
      await sessions.complete(teacher.principal, session.id, "overwrite");
      const retry = await f.db.session.findUniqueOrThrow({
        where: { id: session.id },
      });
      assert.equal(retry.status, "COMPLETED");
      assert.equal(retry.teacherConfirmationNote, "first");
      assert.equal(+retry.teacherConfirmedAt, +confirmed.teacherConfirmedAt);
      assert.equal(
        await f.db.outboxEvent.count({
          where: {
            type: "learning-path.sessions-completed",
            aggregateId: path.id,
          },
        }),
        1,
      );
      assert.deepEqual(await sessions.trySettleCompletedPath(path.id), {
        outcome: "WAITING",
      });
      assert.equal(
        (
          await f.db.creditWallet.findUniqueOrThrow({
            where: { userId: learner.user.id },
          })
        ).heldCredit,
        2000n,
      );
      const report = await reports.createSessionReport(
        learner.principal,
        session.id,
        {
          reasonCode: "NO_SHOW_LATE",
          description: "Integration dispute",
          evidenceFileIds: [],
        },
      );
      const oldEnd = new Date(Date.now() - 3 * 86400000);
      await f.db.session.update({
        where: { id: session.id },
        data: { startAt: new Date(+oldEnd - 3600000), endAt: oldEnd },
      });
      assert.deepEqual(await sessions.trySettleCompletedPath(path.id), {
        outcome: "WAITING",
      });
      assert.equal(
        (
          await f.db.creditWallet.findUniqueOrThrow({
            where: { userId: learner.user.id },
          })
        ).heldCredit,
        2000n,
      );
      // Fixture closes the blocking case; settlement must still be exactly-once under contention.
      await f.db.$transaction(async (tx) => {
        await tx.reportCase.update({
          where: { id: report.id },
          data: { status: "REJECTED", blocksSettlement: false },
        });
        await tx.learningPath.update({
          where: { id: path.id },
          data: { status: "ACTIVE" },
        });
      });
      await Promise.all([
        sessions.trySettleCompletedPath(path.id),
        sessions.trySettleCompletedPath(path.id),
      ]);
      assert.equal(
        (await f.db.learningPath.findUniqueOrThrow({ where: { id: path.id } }))
          .status,
        "COMPLETED",
      );
      assert.equal(
        (
          await f.db.creditWallet.findUniqueOrThrow({
            where: { userId: learner.user.id },
          })
        ).heldCredit,
        0n,
      );
      assert.equal(
        (
          await f.db.creditWallet.findUniqueOrThrow({
            where: { userId: teacher.user.id },
          })
        ).availableCredit,
        11920n,
      );
    } finally {
      await f.dispose();
    }
  },
);
