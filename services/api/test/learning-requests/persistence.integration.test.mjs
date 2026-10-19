import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { LearningRequestLifecycleService } from "../../dist/modules/learning-requests/application/services/learning-request-lifecycle.service.js";
import { PrismaLearningRequestRepository } from "../../dist/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { skip, withDatabase } from "../integration-db.mjs";

async function createUser(prisma, id) {
  return prisma.user.create({
    data: {
      id,
      normalizedEmail: `${id}@learning-request.integration.test`,
      accountStatus: "ACTIVE",
      emailVerified: true,
      termsVersion: "integration",
      termsAcceptedAt: new Date(),
    },
  });
}

test(
  "PostgreSQL persists scoped search, recommendation ranking, and atomic child replacement",
  { skip },
  async () =>
    withDatabase(async (prisma) => {
      const ownerIds = [randomUUID(), randomUUID()];
      const actorId = randomUUID();
      const skillId = randomUUID();
      const tagId = randomUUID();
      const requestIds = [randomUUID(), randomUUID(), randomUUID()];
      let cleanupStarted = false;
      try {
        await Promise.all(
          ownerIds.concat(actorId).map((id) => createUser(prisma, id)),
        );
        cleanupStarted = true;
        await prisma.skill.create({
          data: {
            id: skillId,
            name: `LR integration ${skillId}`,
            slug: `lr-integration-${skillId}`,
            status: "ACTIVE",
          },
        });
        await prisma.tag.create({
          data: { id: tagId, label: `LR ${tagId}`, status: "ACTIVE" },
        });

        const repository = new PrismaLearningRequestRepository(prisma);
        const transactions = new TransactionRunner(prisma);
        const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const slot = {
          startAt: new Date(Date.now() + 60 * 60 * 1000),
          endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        };
        const requestInputs = [
          { ownerId: ownerIds[0], title: "Learn SQL 100%_safe" },
          { ownerId: ownerIds[0], title: "Learn SQL 100xyzsafe" },
          { ownerId: actorId, title: "Learn SQL 100%_safe own" },
        ];
        for (let index = 0; index < requestInputs.length; index += 1) {
          const input = requestInputs[index];
          await transactions.run(async (tx) => {
            await repository.create(tx, {
              id: requestIds[index],
              ownerId: input.ownerId,
              skillId,
              title: input.title,
              description:
                "A sufficiently detailed integration request description.",
              learningGoal: "Build a useful SQL project with a mentor.",
              currentLevel: "BEGINNER",
              verifiedTeacherOnly: false,
              tagIds: [tagId],
              preferredSlots: [slot],
              requestedExpiresAt: null,
              expiryMode: "DEFAULT",
            });
            assert.equal(
              await repository.transition(tx, requestIds[index], 1, ["DRAFT"], {
                status: "OPEN",
                publishedAt: new Date(),
                expiresAt: future,
              }),
              true,
            );
          });
        }

        const fixedCreatedAt = new Date("2026-10-06T12:00:00.000Z");
        await prisma.learningRequest.updateMany({
          where: { id: { in: requestIds } },
          data: { createdAt: fixedCreatedAt },
        });
        const now = await repository.databaseNow(prisma);
        const literalMatches = await repository.findPage(prisma, {
          statuses: ["OPEN"],
          ownerId: ownerIds[0],
          skillId,
          tagIds: [tagId],
          keyword: "100%_safe",
          now,
          after: null,
          take: 10,
        });
        assert.deepEqual(
          literalMatches.map(({ id }) => id),
          [requestIds[0]],
        );

        const allOwned = await repository.findPage(prisma, {
          statuses: ["OPEN"],
          ownerId: ownerIds[0],
          skillId,
          tagIds: [tagId],
          now,
          after: null,
          take: 1,
        });
        const nextOwned = await repository.findPage(prisma, {
          statuses: ["OPEN"],
          ownerId: ownerIds[0],
          skillId,
          tagIds: [tagId],
          now,
          after: { createdAt: allOwned[0].createdAt, id: allOwned[0].id },
          take: 1,
        });
        assert.equal(nextOwned.length, 1);
        assert.notEqual(nextOwned[0].id, allOwned[0].id);

        const recommended = await repository.findRecommended(prisma, {
          candidateSkillIds: [skillId],
          candidateTagIds: [tagId],
          excludeOwnerId: actorId,
          tagIds: [tagId],
          now,
          after: null,
          take: 10,
        });
        assert.equal(
          recommended.some(({ request }) => request.ownerId === actorId),
          false,
        );
        assert.deepEqual(
          recommended.map(({ matchScore }) => matchScore),
          [2, 2],
        );

        const original = await repository.get(prisma, requestIds[0]);
        await assert.rejects(
          () =>
            transactions.run(async (tx) => {
              assert.equal(
                await repository.replaceContent(
                  tx,
                  requestIds[0],
                  original.version,
                  {
                    title: "Learn SQL after a rollback",
                    tagIds: [],
                    preferredSlots: [],
                  },
                ),
                true,
              );
              throw new Error("rollback child replacement");
            }),
          /rollback child replacement/,
        );
        const rolledBack = await repository.get(prisma, requestIds[0]);
        assert.equal(rolledBack.version, original.version);
        assert.equal(rolledBack.title, original.title);
        assert.equal(rolledBack.tagLinks.length, 1);
        assert.equal(rolledBack.preferredSlots.length, 1);
      } finally {
        if (cleanupStarted) {
          await prisma.requestTag.deleteMany({
            where: { requestId: { in: requestIds } },
          });
          await prisma.learningRequest.deleteMany({
            where: { id: { in: requestIds } },
          });
          await prisma.tag.deleteMany({ where: { id: tagId } });
          await prisma.skill.deleteMany({ where: { id: skillId } });
        }
        await prisma.user.deleteMany({
          where: { id: { in: ownerIds.concat(actorId) } },
        });
      }
    }),
);

test(
  "PostgreSQL serializes cancellation against proposal negotiation",
  { skip },
  async () =>
    withDatabase(async (prisma) => {
      const ownerId = randomUUID();
      const proposerId = randomUUID();
      const skillId = randomUUID();
      const requestId = randomUUID();
      let cleanupStarted = false;
      try {
        await Promise.all([
          createUser(prisma, ownerId),
          createUser(prisma, proposerId),
        ]);
        await prisma.skill.create({
          data: {
            id: skillId,
            name: `LR race ${skillId}`,
            slug: `lr-race-${skillId}`,
            status: "ACTIVE",
          },
        });
        cleanupStarted = true;
        const repository = new PrismaLearningRequestRepository(prisma);
        const transactions = new TransactionRunner(prisma);
        const lifecycle = new LearningRequestLifecycleService(repository);
        await transactions.run(async (tx) => {
          await repository.create(tx, {
            id: requestId,
            ownerId,
            skillId,
            title: "Learn cancellation race",
            description:
              "A sufficiently detailed integration request description.",
            learningGoal: "Practice one safe state transition.",
            currentLevel: null,
            verifiedTeacherOnly: false,
            tagIds: [],
            preferredSlots: [],
            requestedExpiresAt: null,
            expiryMode: "DEFAULT",
          });
          await repository.transition(tx, requestId, 1, ["DRAFT"], {
            status: "OPEN",
            publishedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        });
        const initial = await repository.get(prisma, requestId);
        const contenders = await Promise.all([
          transactions.run(async (tx) => {
            const locked = await repository.lock(tx, requestId);
            if (!locked) return false;
            const now = await repository.databaseNow(tx);
            if (locked.status !== "OPEN" || locked.expiresAt <= now)
              return false;
            return repository.transition(
              tx,
              requestId,
              locked.version,
              ["OPEN"],
              { status: "CANCELLED" },
            );
          }),
          transactions
            .run(async (tx) => {
              const available = await lifecycle.lockForProposal(
                tx,
                requestId,
                proposerId,
              );
              await lifecycle.beginNegotiation(
                tx,
                requestId,
                available.version,
              );
              return true;
            })
            .catch((error) => {
              if (error?.getStatus?.() === 409) return false;
              throw error;
            }),
        ]);
        assert.equal(contenders.filter(Boolean).length, 1);
        const final = await repository.get(prisma, requestId);
        assert.equal(final.version, initial.version + 1);
        assert.ok(["CANCELLED", "NEGOTIATING"].includes(final.status));
      } finally {
        if (cleanupStarted) {
          await prisma.requestTag.deleteMany({ where: { requestId } });
          await prisma.learningRequest.deleteMany({ where: { id: requestId } });
          await prisma.skill.deleteMany({ where: { id: skillId } });
        }
        await prisma.user.deleteMany({
          where: { id: { in: [ownerId, proposerId] } },
        });
      }
    }),
);
