import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  LearningChangeState,
  OPEN_CHANGE_STATUSES,
} from "../../../learning-paths/application/services/learning-change-state";
import { lockLearningPath } from "../../../learning-paths/application/services/learning-path-lock";
import { SessionChangesService } from "../../application/services/session-changes.service";
import { databaseNow } from "../../application/services/session-tx";

@Injectable()
export class LearningChangeRecoveryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(LearningChangeRecoveryWorker.name);
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly changes: LearningChangeState,
    private readonly sessions: SessionChangesService,
  ) {}
  onModuleInit() {
    const run = () => {
      void this.sweep().catch(() =>
        this.logger.error("LEARNING_CHANGE_RECOVERY_UNAVAILABLE"),
      );
    };
    this.timer = setInterval(run, 30_000);
    this.timer.unref();
    run();
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
  async sweep() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      let cursor: string | undefined;
      while (!this.stopped) {
        // Scan open requests by key; each mutation uses database time, never host time.
        const rows = await this.db.learningChangeRequest.findMany({
          where: {
            status: { in: OPEN_CHANGE_STATUSES },
            approvedAt: null,
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: "asc" },
          take: 100,
        });
        for (const row of rows) {
          if (this.stopped) break;
          await this.recover(row).catch(() =>
            this.logger.error("LEARNING_CHANGE_RECOVERY_DEFERRED"),
          );
        }
        if (rows.length < 100) break;
        cursor = rows.at(-1)!.id;
      }
    } finally {
      this.running = false;
    }
  }
  private recover(row: {
    id: string;
    sessionId: string | null;
    pathId: string;
  }) {
    if (row.sessionId) return this.sessions.recover(row.sessionId, row.id);
    return this.transactions.run(async (tx) => {
      await lockLearningPath(tx, row.pathId);
      await this.changes.expire(tx, row.pathId, await databaseNow(tx));
    });
  }
}
