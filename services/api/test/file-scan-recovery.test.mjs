import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import { FileScanProcessor } from "../dist/infrastructure/storage/file-scan.processor.js";
import { skip, withDatabase } from "./integration-db.mjs";
import {
  meta,
  newFile,
  repositoryFor,
  scanRequests,
} from "./stored-file-fixture.mjs";

// Real PostgreSQL lifecycle; object storage and scanner are fixtures here.
// Real S3/ClamAV evidence stays Pending in specs/004-private-file-storage/validation.md.
const objects = {
  head: async () => ({ size: 9 }),
  read: async () => Readable.from([Buffer.from("%PDF-1.7\n")]),
};
const scannerReturning = (verdict) => ({
  scan: async () => ({ verdict, scannerVersion: "fixture-scanner" }),
});

async function quarantined(repository) {
  const file = newFile();
  await repository.createUploading(file);
  await repository.finalize(meta(file.id));
  return file;
}

test(
  "worker crash after claim: lease recovery re-requests the scan and a stale verdict cannot write",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const repository = repositoryFor(prisma);
      const file = await quarantined(repository);

      const crashed = await repository.claim(file.id, 1);
      assert.equal(crashed.attempt, 1);
      assert.equal(
        await repository.claim(file.id, 1),
        null,
        "a live lease blocks a duplicate worker",
      );

      await prisma.$executeRaw`
    UPDATE "stored_files" SET "scan_lease_until" = CURRENT_TIMESTAMP - INTERVAL '1 hour'
    WHERE "id" = ${file.id}::uuid`;
      assert.ok((await repository.reconcileExpiredScans(50)) >= 1);
      assert.equal(await repository.currentState(file.id), "QUARANTINED");
      assert.equal(await scanRequests(prisma, file.id), 2);
      assert.equal(
        await repository.complete({
          claim: crashed,
          verdict: "CLEAN",
          scannerVersion: "stale",
        }),
        false,
      );
      assert.equal(await repository.currentState(file.id), "QUARANTINED");

      const processor = new FileScanProcessor(
        repository,
        objects,
        scannerReturning("CLEAN"),
      );
      assert.equal(await processor.process(file.id, 1), "READY");
      const row = await prisma.storedFile.findUniqueOrThrow({
        where: { id: file.id },
        include: { scanEvents: true },
      });
      assert.deepEqual(
        [row.scanVerdict, row.scannerVersion, row.scanAttempts],
        ["CLEAN", "fixture-scanner", 2],
      );
      assert.deepEqual(
        row.scanEvents.map((event) => [event.attempt, event.verdict]),
        [[2, "CLEAN"]],
      );

      // READY evidence is immutable in the database, and a duplicate job is a no-op.
      await assert.rejects(
        prisma.storedFile.update({
          where: { id: file.id },
          data: { state: "QUARANTINED" },
        }),
      );
      assert.equal(await processor.process(file.id, 1), "READY");
      assert.equal(
        await prisma.storedFileScanEvent.count({ where: { fileId: file.id } }),
        1,
      );
    }),
);

test(
  "scanner outage fails closed after three attempts; requeue still needs a real verdict",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const repository = repositoryFor(prisma);
      const file = await quarantined(repository);
      const outage = new FileScanProcessor(repository, objects, {
        scan: async () => {
          throw new Error("clamd unreachable");
        },
      });

      await assert.rejects(outage.process(file.id, 1), /FILE_SCAN_RETRY/);
      await assert.rejects(outage.process(file.id, 1), /FILE_SCAN_RETRY/);
      assert.equal(await outage.process(file.id, 1), "SCAN_FAILED");
      const failed = await prisma.storedFile.findUniqueOrThrow({
        where: { id: file.id },
        include: { scanEvents: true },
      });
      assert.deepEqual(
        [failed.state, failed.failureCode, failed.scanVerdict],
        ["SCAN_FAILED", "SCAN_UNKNOWN", "UNKNOWN"],
      );
      assert.deepEqual(
        failed.scanEvents.map((event) => event.verdict),
        ["UNKNOWN", "UNKNOWN", "UNKNOWN"],
      );

      await assert.rejects(
        repository.requeueFailed(randomUUID(), randomUUID()),
        /FILE_SCAN_STATE_CONFLICT/,
      );
      await repository.requeueFailed(file.id, randomUUID());
      assert.equal(await repository.currentState(file.id), "QUARANTINED");
      assert.equal(await scanRequests(prisma, file.id), 2);
      assert.equal(
        await new FileScanProcessor(
          repository,
          objects,
          scannerReturning("INFECTED"),
        ).process(file.id, 1),
        "REJECTED",
      );
      assert.equal(await repository.currentState(file.id), "REJECTED");
    }),
);
