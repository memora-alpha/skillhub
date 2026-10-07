import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { OutboxConsumer } from "../../dist/infrastructure/events/outbox-consumer.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { LearningRequestRejectionPublisher } from "../../dist/modules/notifications/infrastructure/events/learning-request-rejection.publisher.js";
import { PrismaNotificationRepository } from "../../dist/modules/notifications/infrastructure/persistence/prisma-notification.repository.js";
import { skip, withDatabase } from "../integration-db.mjs";

async function createOwner(prisma, ownerId) {
  await prisma.user.create({
    data: {
      id: ownerId,
      normalizedEmail: `${ownerId}@notification.integration.test`,
      accountStatus: "ACTIVE",
      emailVerified: true,
      termsVersion: "integration",
      termsAcceptedAt: new Date(),
    },
  });
}

test(
  "PostgreSQL receipt and notification commit once and roll back together on delivery failure",
  { skip },
  async () =>
    withDatabase(async (prisma) => {
      const eventId = randomUUID();
      const requestId = randomUUID();
      const ownerId = randomUUID();
      const consumerName = "learning-request-rejection-in-app-v1";
      const event = {
        eventId,
        type: "learning-request.rejected",
        version: 1,
        correlationId: randomUUID(),
        payload: {
          requestId,
          ownerId,
          reviewedVersion: 3,
          decisionVersion: 4,
          rejectReason: "Please clarify your learning goal",
        },
      };
      const publisher = new LearningRequestRejectionPublisher(
        new OutboxConsumer(new TransactionRunner(prisma)),
        new PrismaNotificationRepository(prisma),
        new OutboxPublisherRegistry(),
      );
      try {
        await assert.rejects(() => publisher.publish(event));
        assert.equal(
          await prisma.outboxConsumerReceipt.count({
            where: { consumer: consumerName, eventId },
          }),
          0,
        );
        await createOwner(prisma, ownerId);
        await publisher.publish(event);
        await publisher.publish(event);

        const notification = await prisma.notification.findUnique({
          where: { id: eventId },
        });
        assert.equal(notification.userId, ownerId);
        assert.equal(notification.channel, "IN_APP");
        assert.match(notification.body, /Please clarify your learning goal/);
        assert.deepEqual(notification.payload, {
          requestId,
          reviewedVersion: 3,
          decisionVersion: 4,
        });
        assert.equal(
          await prisma.notification.count({ where: { id: eventId } }),
          1,
        );
        assert.equal(
          await prisma.outboxConsumerReceipt.count({
            where: { consumer: consumerName, eventId },
          }),
          1,
        );
      } finally {
        await prisma.notification.deleteMany({ where: { id: eventId } });
        await prisma.outboxConsumerReceipt.deleteMany({
          where: { consumer: consumerName, eventId },
        });
        await prisma.user.deleteMany({ where: { id: ownerId } });
      }
    }),
);
