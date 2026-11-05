import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { PathTerminationService } from "../../application/services/path-termination.service";

@Injectable()
export class PathTerminationRecoveryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(PathTerminationRecoveryWorker.name);
  constructor(
    private readonly db: PrismaService,
    private readonly termination: PathTerminationService,
  ) {}
  onModuleInit() {
    const run = () => {
      void this.sweep().catch(() =>
        this.logger.error("TERMINATION_RECOVERY_UNAVAILABLE"),
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
        const rows = await this.db.learningChangeRequest.findMany({
          where: {
            kind: "PATH_TERMINATION",
            status: "ACCEPTED",
            approvedAt: { not: null },
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          orderBy: { id: "asc" },
          take: 100,
          select: { id: true, pathId: true },
        });
        // Each independent agreement commits its financial operation and audit before advancing.
        for (const row of rows) {
          if (this.stopped) break;
          await this.termination
            .recoverApproved(row.pathId, row.id)
            .catch(() => this.logger.error("TERMINATION_RECOVERY_DEFERRED"));
        }
        if (rows.length < 100) break;
        cursor = rows.at(-1)!.id;
      }
    } finally {
      this.running = false;
    }
  }
}
