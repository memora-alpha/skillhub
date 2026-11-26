import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { SessionRecordingRetentionService } from "../../application/services/session-recording-retention.service";

const SWEEP_INTERVAL_MS = 60 * 60_000;
const PAGE_SIZE = 100;

export type RetentionSweep = {
  expired: number;
  removed: number;
  monthlyMinutes: number;
};

/** Spec 020 D6/D9: hourly expiry, object removal and the monthly minutes alert. */
@Injectable()
export class SessionRecordingRetentionWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(SessionRecordingRetentionWorker.name);

  constructor(private readonly retention: SessionRecordingRetentionService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error("RECORDING_RETENTION_DEFERRED"),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Never overlaps; returns null when a pass is already running or the worker stopped. */
  async sweep(): Promise<RetentionSweep | null> {
    if (this.running || this.stopped) return null;
    this.running = true;
    try {
      let expired = 0;
      let next: string | null | undefined;
      do {
        const page = await this.retention.expirePage(
          PAGE_SIZE,
          next ?? undefined,
        );
        expired += page.expired;
        next = page.next;
      } while (next && !this.stopped);
      const removed = await this.retention.removeObjects(PAGE_SIZE);
      const monthlyMinutes = await this.retention.checkMonthlyMinutes();
      if (expired || removed)
        this.logger.log(
          `Recordings expired ${expired}, objects removed ${removed}`,
        );
      return { expired, removed, monthlyMinutes };
    } finally {
      this.running = false;
    }
  }
}
