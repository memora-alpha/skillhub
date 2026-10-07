import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../database/transaction-runner";
import { PrismaService } from "../database/prisma.service";
import { OutboxWriter } from "../events/outbox-writer";
import {
  FileStorageError,
  type FilePurpose,
  type StoredFileState,
} from "./file.types";
import type {
  StoredFileRecord,
  StoredFileRepository,
} from "./stored-file.repository";
import type { ScanClaim, ScanRepository } from "./scan-repository.port";
import type { ScanVerdict } from "./malware-scanner.port";
import type {
  CleanupCandidate,
  ReconciliationRepository,
} from "./reconciliation-repository.port";

/** UNKNOWN never becomes READY: it goes back to QUARANTINED, then fails closed on the third attempt. */
function stateAfterVerdict(
  verdict: ScanVerdict,
  attempt: number,
): StoredFileState {
  if (verdict === "CLEAN") return "READY";
  if (verdict === "INFECTED") return "REJECTED";
  return attempt >= 3 ? "SCAN_FAILED" : "QUARANTINED";
}

type ExpiredScan = {
  id: string;
  generation: number;
  scanAttempts: number;
  scanLeaseToken: string | null;
  scanLeaseUntil: Date | null;
};

@Injectable()
export class PrismaStoredFileRepository
  implements StoredFileRepository, ScanRepository, ReconciliationRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly outbox: OutboxWriter,
  ) {}

  async createUploading(row: Omit<StoredFileRecord, "state">): Promise<void> {
    await this.prisma.storedFile.create({
      data: {
        id: row.id,
        purpose: row.purpose,
        uploadedBy: row.uploadedBy,
        objectKey: row.objectKey,
        generation: row.generation,
        originalName: row.originalName,
        state: "UPLOADING",
      },
    });
  }

  async finalize(input: {
    id: string;
    generation: number;
    detectedMime: string;
    sizeBytes: number;
    sha256: string;
    correlationId: string;
  }): Promise<void> {
    await this.transactions.run(async (tx) => {
      const result = await tx.storedFile.updateMany({
        where: {
          id: input.id,
          generation: input.generation,
          state: "UPLOADING",
        },
        data: {
          detectedMime: input.detectedMime,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
          state: "QUARANTINED",
        },
      });
      if (result.count !== 1)
        throw new FileStorageError("FILE_UPLOAD_STATE_CONFLICT", 409);
      await this.outbox.append(tx, {
        eventId: randomUUID(),
        type: "file.scan.requested",
        version: 1,
        payload: { fileId: input.id, generation: input.generation },
        correlationId: input.correlationId,
      });
    });
  }

  async failUpload(id: string): Promise<void> {
    await this.prisma.storedFile.updateMany({
      where: { id, state: "UPLOADING" },
      data: {
        state: "UPLOAD_FAILED",
        failureCode: "UPLOAD_OR_VALIDATION_FAILED",
      },
    });
  }

  async find(id: string): Promise<StoredFileRecord | null> {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      purpose: row.purpose as FilePurpose,
      uploadedBy: row.uploadedBy,
      objectKey: row.objectKey,
      generation: row.generation,
      originalName: row.originalName,
      detectedMime: row.detectedMime,
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      state: row.state as StoredFileState,
    };
  }

  async claim(fileId: string, generation: number): Promise<ScanClaim | null> {
    const leaseToken = randomUUID();
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        generation: number;
        object_key: string;
        size_bytes: number;
        sha256: string;
        scan_attempts: number;
        scan_lease_token: string;
      }>
    >`
      UPDATE "stored_files"
      SET "state" = 'SCANNING',
          "scan_attempts" = "scan_attempts" + 1,
          "scan_lease_token" = ${leaseToken}::uuid,
          "scan_lease_until" = CURRENT_TIMESTAMP + INTERVAL '60 seconds',
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${fileId}::uuid AND "generation" = ${generation}
        AND "scan_attempts" < 3
        AND ("state" = 'QUARANTINED' OR ("state" = 'SCANNING' AND "scan_lease_until" < CURRENT_TIMESTAMP))
      RETURNING "id", "generation", "object_key", "size_bytes", "sha256", "scan_attempts", "scan_lease_token"
    `;
    const row = rows[0];
    if (!row?.sha256 || !row.size_bytes) return null;
    return {
      id: row.id,
      generation: row.generation,
      objectKey: row.object_key,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      attempt: row.scan_attempts,
      leaseToken: row.scan_lease_token,
    };
  }

  async complete(input: {
    claim: ScanClaim;
    verdict: ScanVerdict;
    scannerVersion: string;
  }): Promise<boolean> {
    const { claim, verdict, scannerVersion } = input;
    const nextState = stateAfterVerdict(verdict, claim.attempt);
    return this.transactions.run(async (tx) => {
      const updated = await tx.storedFile.updateMany({
        where: {
          id: claim.id,
          generation: claim.generation,
          state: "SCANNING",
          sha256: claim.sha256,
          scanLeaseToken: claim.leaseToken,
        },
        data: {
          state: nextState,
          scanVerdict: verdict,
          scannerVersion,
          scannedAt: new Date(),
          scanLeaseToken: null,
          scanLeaseUntil: null,
          failureCode: verdict === "UNKNOWN" ? "SCAN_UNKNOWN" : null,
        },
      });
      if (updated.count === 0) return false;
      await tx.$executeRaw`
        INSERT INTO "stored_file_scan_events"
          ("id", "file_id", "generation", "attempt", "lease_token", "verdict", "scanner_version", "failure_code")
        VALUES
          (${randomUUID()}::uuid, ${claim.id}::uuid, ${claim.generation}, ${claim.attempt},
           ${claim.leaseToken}::uuid, ${verdict}, ${scannerVersion}, ${verdict === "UNKNOWN" ? "SCAN_UNKNOWN" : null})
      `;
      return true;
    });
  }

  async currentState(fileId: string): Promise<string | null> {
    const row = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { state: true },
    });
    return row?.state ?? null;
  }

  async requeueFailed(fileId: string, correlationId: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      const row = await tx.storedFile.findUnique({
        where: { id: fileId },
        select: { generation: true, state: true },
      });
      if (row?.state !== "SCAN_FAILED")
        throw new FileStorageError("FILE_SCAN_STATE_CONFLICT", 409);
      const updated = await tx.storedFile.updateMany({
        where: { id: fileId, state: "SCAN_FAILED", generation: row.generation },
        data: {
          state: "QUARANTINED",
          scanAttempts: 0,
          scanLeaseToken: null,
          scanLeaseUntil: null,
          failureCode: null,
        },
      });
      if (updated.count !== 1)
        throw new FileStorageError("FILE_SCAN_STATE_CONFLICT", 409);
      await this.outbox.append(tx, {
        eventId: randomUUID(),
        type: "file.scan.requested",
        version: 1,
        payload: { fileId, generation: row.generation },
        correlationId,
      });
    });
  }

  async claimCleanup(
    graceBefore: Date,
    limit: number,
  ): Promise<CleanupCandidate[]> {
    const candidates = await this.prisma.storedFile.findMany({
      where: {
        attachedAt: null,
        OR: [
          {
            state: { in: ["UPLOADING", "UPLOAD_FAILED"] },
            createdAt: { lt: graceBefore },
          },
          { state: "CLEANUP_PENDING" },
          {
            state: "READY",
            purpose: "EVIDENCE",
            createdAt: { lt: graceBefore },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: { id: true },
    });
    if (candidates.length === 0) return [];
    const ids = candidates.map((row) => row.id);
    // One CAS for the page: an upload finalized since the read no longer matches
    // and is therefore absent from the claimed rows read back below.
    await this.prisma.storedFile.updateMany({
      where: {
        id: { in: ids },
        attachedAt: null,
        OR: [
          { state: { in: ["UPLOADING", "UPLOAD_FAILED"] } },
          { state: "READY", purpose: "EVIDENCE" },
        ],
        createdAt: { lt: graceBefore },
      },
      data: { state: "CLEANUP_PENDING" },
    });
    return this.prisma.storedFile.findMany({
      where: { id: { in: ids }, state: "CLEANUP_PENDING", attachedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, objectKey: true },
    });
  }

  async markDeleted(id: string): Promise<void> {
    await this.prisma.storedFile.updateMany({
      where: { id, state: "CLEANUP_PENDING" },
      data: { state: "DELETED" },
    });
  }

  async reconcileExpiredScans(limit: number): Promise<number> {
    const expired = await this.prisma.storedFile.findMany({
      where: { state: "SCANNING", scanLeaseUntil: { lt: new Date() } },
      orderBy: { scanLeaseUntil: "asc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        generation: true,
        scanAttempts: true,
        scanLeaseToken: true,
        scanLeaseUntil: true,
      },
    });
    // Rows are independent and each recovery is its own transaction.
    const recovered = await Promise.all(
      expired.map((row) => this.recoverExpiredScan(row)),
    );
    return recovered.filter(Boolean).length;
  }

  private async recoverExpiredScan(row: ExpiredScan): Promise<boolean> {
    if (!row.scanLeaseToken || !row.scanLeaseUntil) return false;
    return this.transactions.run(async (tx) => {
      const terminal = row.scanAttempts >= 3;
      const result = await tx.storedFile.updateMany({
        where: {
          id: row.id,
          generation: row.generation,
          state: "SCANNING",
          scanLeaseToken: row.scanLeaseToken,
          scanLeaseUntil: { lt: new Date() },
        },
        data: {
          state: terminal ? "SCAN_FAILED" : "QUARANTINED",
          scanLeaseToken: null,
          scanLeaseUntil: null,
          failureCode: "SCAN_LEASE_EXPIRED",
        },
      });
      if (result.count !== 1) return false;
      if (!terminal) {
        await this.outbox.append(tx, {
          eventId: randomUUID(),
          type: "file.scan.requested",
          version: 1,
          payload: { fileId: row.id, generation: row.generation },
          correlationId: randomUUID(),
        });
      }
      return true;
    });
  }
}
