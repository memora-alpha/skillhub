import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../../../../infrastructure/storage/object-storage.port";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { sessionsHeldByReport } from "./report-hold";
import { removeRecordingObject } from "./session-recording.service";
import { databaseNow } from "./session-tx";

const DAY_MS = 86_400_000;

export type RetentionPage = { expired: number; next: string | null };

/**
 * Spec 020 D6: READY recordings expire `recording.retentionDays` after the Session ends,
 * unless an open report on the Session holds them. Expired and deleted rows keep their
 * metadata; only the object is removed.
 */
@Injectable()
export class SessionRecordingRetentionService {
  private readonly logger = new Logger(SessionRecordingRetentionService.name);
  private alertedMonth: string | null = null;

  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly configuration: SystemConfigurationService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
  ) {}

  /**
   * Expires one page in a Serializable transaction, so a report filed at the same moment
   * either holds the row or retries the page. Paging by id keeps held rows from stalling.
   */
  async expirePage(limit: number, after?: string): Promise<RetentionPage> {
    return this.transactions.run(async (tx) => {
      const now = await databaseNow(tx);
      const { values } = await this.configuration.getSnapshot(
        ["recording.retentionDays"],
        tx,
      );
      const cutoff = new Date(
        +now - values["recording.retentionDays"] * DAY_MS,
      );
      const due = await tx.sessionRecording.findMany({
        where: {
          status: "READY",
          session: { is: { endAt: { lte: cutoff } } },
          ...(after ? { id: { gt: after } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true, sessionId: true },
      });
      if (due.length === 0) return { expired: 0, next: null };
      const held = await sessionsHeldByReport(
        tx,
        due.map((row) => row.sessionId),
      );
      const ids = due
        .filter((row) => !held.has(row.sessionId))
        .map((row) => row.id);
      const { count } = ids.length
        ? await tx.sessionRecording.updateMany({
            where: { id: { in: ids }, status: "READY" },
            data: { status: "EXPIRED", deletedAt: now },
          })
        : { count: 0 };
      return {
        expired: count,
        next: due.length < limit ? null : due.at(-1)!.id,
      };
    });
  }

  /** Removes objects of EXPIRED and DELETED rows, including removals that failed before. */
  async removeObjects(limit: number): Promise<number> {
    const rows = await this.db.sessionRecording.findMany({
      where: {
        status: { in: ["EXPIRED", "DELETED"] },
        objectKey: { not: null },
      },
      orderBy: { deletedAt: "asc" },
      take: limit,
      select: { id: true, objectKey: true },
    });
    let removed = 0;
    for (const row of rows) {
      // Sequential on purpose: storage calls are rate-limited and each clears its own key.
      if (await removeRecordingObject(this.db, this.objects, row)) removed += 1;
    }
    return removed;
  }

  /**
   * Spec D9: logs one ops alert per month once recorded minutes reach
   * `recording.monthlyAlertMinutes` (0 turns it off). Returns this month's minutes.
   */
  async checkMonthlyMinutes(): Promise<number> {
    const { values } = await this.configuration.getSnapshot([
      "recording.monthlyAlertMinutes",
    ]);
    const threshold = values["recording.monthlyAlertMinutes"];
    const now = await this.transactions.run(databaseNow);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const sum = await this.db.sessionRecording.aggregate({
      where: { endedAt: { gte: monthStart }, durationMs: { not: null } },
      _sum: { durationMs: true },
    });
    const minutes = Number(BigInt(sum._sum.durationMs ?? 0) / 60_000n);
    const month = monthStart.toISOString().slice(0, 7);
    if (threshold > 0 && minutes >= threshold && this.alertedMonth !== month) {
      this.alertedMonth = month;
      this.logger.warn(
        `RECORDING_MONTHLY_MINUTES_ALERT month=${month} minutes=${minutes} threshold=${threshold}`,
      );
    }
    return minutes;
  }
}
