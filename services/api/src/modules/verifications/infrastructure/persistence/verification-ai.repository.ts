import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Prisma } from "../../../../generated/prisma/client";
import { AI_MAX_ATTEMPTS } from "../../domain/verification-ai.config";

@Injectable()
export class VerificationAiRepository {
  constructor(private readonly db: PrismaService) {}

  async get(id: string, tx: TransactionContext = this.db, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT id FROM verification_ai_analyses WHERE id=${id}::uuid FOR UPDATE`;
    const row = await tx.verificationAiAnalysis.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  latest(verificationId: string, tx: TransactionContext) {
    return tx.verificationAiAnalysis.findFirst({
      where: { verificationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  reusable(
    tx: TransactionContext,
    verificationId: string,
    inputHash: string,
    model: string,
    promptVersion: string,
  ) {
    return tx.verificationAiAnalysis.findFirst({
      where: {
        verificationId,
        OR: [
          { status: { in: ["QUEUED", "PROCESSING"] } },
          {
            inputHash,
            model,
            promptVersion,
            status: { in: ["SUCCEEDED", "UNSUPPORTED"] },
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  count(tx: TransactionContext, verificationId: string) {
    return tx.verificationAiAnalysis.count({ where: { verificationId } });
  }

  create(
    tx: TransactionContext,
    data: Prisma.VerificationAiAnalysisUncheckedCreateInput,
  ) {
    return tx.verificationAiAnalysis.create({ data });
  }

  async claim(tx: TransactionContext, id: string, leaseMs: number) {
    const row = await this.get(id, tx, true);
    if (row.status !== "QUEUED") return null;
    if (row.attempts >= AI_MAX_ATTEMPTS) {
      await tx.verificationAiAnalysis.update({
        where: { id },
        data: {
          status: "FAILED",
          errorCode: "AI_ATTEMPTS_EXHAUSTED",
          completedAt: new Date(),
        },
      });
      return null;
    }
    return tx.verificationAiAnalysis.update({
      where: { id },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + leaseMs),
        errorCode: null,
      },
    });
  }

  async finish(
    tx: TransactionContext,
    id: string,
    leaseToken: string,
    data: {
      status: "SUCCEEDED" | "FAILED" | "QUEUED" | "STALE";
      result?: Prisma.InputJsonObject;
      errorCode?: string;
    },
  ) {
    const updated = await tx.verificationAiAnalysis.updateMany({
      where: {
        id,
        status: "PROCESSING",
        leaseToken,
        leaseUntil: { gt: new Date() },
      },
      data: {
        ...data,
        leaseToken: null,
        leaseUntil: null,
        completedAt: data.status === "QUEUED" ? null : new Date(),
      },
    });
    return updated.count === 1;
  }

  async recover(tx: TransactionContext) {
    const rows = await tx.$queryRaw<{ id: string; attempts: number }[]>`
      SELECT id, attempts FROM verification_ai_analyses
      WHERE (status='PROCESSING' AND lease_until < CURRENT_TIMESTAMP)
        OR (status='QUEUED' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
      ORDER BY updated_at, id FOR UPDATE SKIP LOCKED LIMIT 20`;
    const pending: string[] = [];
    // A single transaction owns these row locks; each transition must precede its outbox write.
    for (const row of rows) {
      const exhausted = row.attempts >= AI_MAX_ATTEMPTS;
      await tx.verificationAiAnalysis.update({
        where: { id: row.id },
        data: {
          status: exhausted ? "FAILED" : "QUEUED",
          leaseToken: null,
          leaseUntil: null,
          errorCode: exhausted
            ? "AI_ATTEMPTS_EXHAUSTED"
            : "AI_DELIVERY_RECOVERED",
          completedAt: exhausted ? new Date() : null,
        },
      });
      if (!exhausted) pending.push(row.id);
    }
    return pending;
  }
}
