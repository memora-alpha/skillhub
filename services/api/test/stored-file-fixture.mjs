import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { OutboxWriter } from "../dist/infrastructure/events/outbox-writer.js";
import { PrismaStoredFileRepository } from "../dist/infrastructure/storage/prisma-stored-file.repository.js";

export const repositoryFor = (prisma) =>
  new PrismaStoredFileRepository(
    prisma,
    new TransactionRunner(prisma),
    new OutboxWriter(),
  );

export function newFile() {
  const id = randomUUID();
  return {
    id,
    purpose: "EVIDENCE",
    uploadedBy: randomUUID(),
    objectKey: `private/${id}`,
    generation: 1,
    originalName: "evidence.pdf",
  };
}

export const meta = (id, correlationId = randomUUID()) => ({
  id,
  generation: 1,
  detectedMime: "application/pdf",
  sizeBytes: 9,
  sha256: "a".repeat(64),
  correlationId,
});

export const scanRequests = (prisma, fileId) =>
  prisma.outboxEvent.count({
    where: {
      type: "file.scan.requested",
      payload: { path: ["fileId"], equals: fileId },
    },
  });
