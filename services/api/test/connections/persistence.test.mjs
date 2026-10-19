import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import { ProposalsService } from "../../dist/modules/proposals/application/proposals.service.js";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { connectionSettings } from "../../dist/modules/proposals/domain/connection-policy.js";
import { lockUsers } from "../../dist/shared/database/identity-transactions.js";
import { ConversationLifecycleService } from "../../dist/modules/conversations/application/conversation-lifecycle.service.js";
import { ConnectionNotificationService } from "../../dist/modules/notifications/application/services/connection-notification.service.js";

// No fallback to application configuration. All migrations run in a disposable schema.
const url = process.env.TEST_DATABASE_URL;
test(
  "real PostgreSQL migrations, parallel acceptance, deterministic feed and notification transitions",
  {
    skip: !url && "Set TEST_DATABASE_URL to an isolated PostgreSQL server",
    timeout: 120000,
  },
  async () => {
    const schema = `connections_test_${randomUUID().replaceAll("-", "")}`;
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    let db;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const root = new URL("../../prisma/migrations/", import.meta.url);
      for (const name of (await readdir(root))
        .filter((name) => /^2026/.test(name))
        .sort())
        await client.query(
          await readFile(new URL(`${name}/migration.sql`, root), "utf8"),
        );
      db = new PrismaClient({
        adapter: new PrismaPg(
          { connectionString: url, options: `-c search_path=${schema}` },
          { schema },
        ),
      });
      await db.$connect();
      const role = await db.role.findUniqueOrThrow({ where: { code: "USER" } });
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (const id of ids)
        await db.user.create({
          data: {
            id,
            roleId: role.id,
            normalizedEmail: `${id}@connections.test`,
            fullName: "Test participant",
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
      const skill = await db.skill.create({
        data: {
          name: "Connections test",
          nameKey: randomUUID(),
          slug: randomUUID(),
          status: "ACTIVE",
        },
      });
      const request = await db.learningRequest.create({
        data: {
          ownerId: ids[0],
          skillId: skill.id,
          title: "Connection request",
          description: "Description for connection request",
          learningGoal: "A suitable learning goal",
          currentLevel: "BEGINNER",
          status: "OPEN",
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const proposals = [];
      for (const proposerId of ids.slice(1))
        proposals.push(
          await db.proposal.create({
            data: {
              sourceType: "LEARNING_REQUEST",
              requestId: request.id,
              proposerId,
              recipientId: ids[0],
              skillId: skill.id,
              message: "A suitable proposal",
              candidateSlots: "Tối Thứ 5 và Thứ 7",
              status: "PENDING",
              expiresAt: new Date(Date.now() + 86400000),
            },
          }),
        );
      const transactions = new TransactionRunner(db),
        commands = new IdempotencyService(transactions);
      const actors = {
        require: async (tx, principal, _permission, others = []) => {
          await lockUsers(tx, [principal.userId, ...others]);
          return { userId: principal.userId, roles: ["USER"] };
        },
        assertConnectionParty: async () => {},
      };
      const events = {
        lockRecipients: async (tx, users) => {
          for (const user of [...users].sort()) {
            await tx.$executeRaw`INSERT INTO user_event_streams(user_id) VALUES(${user}::uuid) ON CONFLICT DO NOTHING`;
            await tx.$queryRaw`SELECT user_id FROM user_event_streams WHERE user_id=${user}::uuid FOR UPDATE`;
          }
        },
        append: async (tx, users, source, type, payload) => {
          for (const user of [...users].sort())
            await tx.$executeRaw`SELECT skillhub_append_user_event(${user}::uuid,${source}::uuid,${type},${JSON.stringify(payload)}::jsonb)`;
        },
      };
      const service = new ProposalsService(
        db,
        transactions,
        commands,
        actors,
        { assertTeacherEligible: async () => {} },
        new LearningRequestLifecycleService(
          new PrismaLearningRequestRepository(db),
        ),
        events,
        { policy: connectionSettings({}) },
        { append: async () => {} },
        new ConversationLifecycleService(),
        new ConnectionNotificationService(),
      );
      const principal = { userId: ids[0] },
        command = {
          principal,
          key: randomUUID(),
          context: { requestId: randomUUID(), correlationId: randomUUID() },
        };
      const results = await Promise.allSettled(
        proposals.map((proposal, index) =>
          service.mutate(
            { ...command, key: `accept-${index}` },
            proposal.id,
            "accept",
            { expectedVersion: 1 },
          ),
        ),
      );
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        await db.conversation.count({ where: { requestId: request.id } }),
        1,
      );
      assert.equal(
        (
          await db.learningRequest.findUniqueOrThrow({
            where: { id: request.id },
          })
        ).status,
        "NEGOTIATING",
      );
      assert.equal(await db.session.count(), 0);
      assert.equal(await db.creditTransaction.count(), 0);
      const winner = results.findIndex(
        (result) => result.status === "fulfilled",
      );
      assert.equal(
        results[winner].value.proposal.candidateSlots,
        "Tối Thứ 5 và Thứ 7",
      );
      assert.equal(
        (
          await db.proposal.findUniqueOrThrow({
            where: { id: proposals[winner].id },
          })
        ).candidateSlots,
        "Tối Thứ 5 và Thứ 7",
      );
      const replay = await service.mutate(
        { ...command, key: `accept-${winner}` },
        proposals[winner].id,
        "accept",
        { expectedVersion: 1 },
      );
      assert.equal(
        replay.conversation.id,
        results[winner].value.conversation.id,
      );
      const source = randomUUID(),
        userId = ids[0];
      await Promise.all(
        Array.from({ length: 8 }, () =>
          transactions.run((tx) =>
            events.append(tx, [userId], source, "chat.read.updated", {
              conversationId: replay.conversation.id,
              readerId: userId,
              lastReadSequence: "1",
            }),
          ),
        ),
      );
      const duplicates = await db.userEventDelivery.count({
        where: { userId, type: "chat.read.updated" },
      });
      assert.equal(duplicates, 1);
      const inbox = await db.notification.findFirstOrThrow();
      await db.notification.update({
        where: { id: inbox.id },
        data: { readAt: new Date() },
      });
      await db.notification.update({
        where: { id: inbox.id },
        data: { readAt: new Date() },
      });
      assert.equal(
        await db.userEventDelivery.count({
          where: { userId: inbox.userId, type: "notification.created" },
        }),
        1,
      );
      assert.equal(
        await db.userEventDelivery.count({
          where: { userId: inbox.userId, type: "notification.read" },
        }),
        1,
      );
      const feed = await db.userEventDelivery.findMany({
        where: { userId },
        orderBy: { sequence: "asc" },
      });
      for (let index = 0; index < feed.length; index++)
        assert.equal(feed[index].sequence, BigInt(index + 1));
      const readEvent = feed.find((row) => row.type === "chat.read.updated");
      assert(readEvent);
      await db.userEventDelivery.delete({
        where: { userId_sequence: { userId, sequence: readEvent.sequence } },
      });
      // Simulate replay-prefix trimming: the durable wakeup receipt retains logical dedupe.
      await transactions.run((tx) =>
        events.append(tx, [userId], source, "chat.read.updated", {
          conversationId: replay.conversation.id,
          readerId: userId,
          lastReadSequence: "1",
        }),
      );
      assert.equal(
        await db.userEventDelivery.count({
          where: { userId, type: "chat.read.updated" },
        }),
        0,
      );
    } finally {
      await db?.$disconnect();
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`);
      await client.end();
    }
  },
);
