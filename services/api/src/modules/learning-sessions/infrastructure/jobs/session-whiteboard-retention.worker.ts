import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { SessionWhiteboardService } from "../../application/services/session-whiteboard.service";

const SWEEP_INTERVAL_MS = 60 * 60_000;
const PAGE_SIZE = 100;

/** Spec 019 P3: hourly deletion of expired whiteboard scenes. */
@Injectable()
export class SessionWhiteboardRetentionWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(SessionWhiteboardRetentionWorker.name);

  constructor(private readonly whiteboards: SessionWhiteboardService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error("WHITEBOARD_RETENTION_DEFERRED"),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    let total = 0;
    try {
      let next: string | null | undefined;
      do {
        const page = await this.whiteboards.purgeExpired(
          PAGE_SIZE,
          next ?? undefined,
        );
        total += page.deleted;
        next = page.next;
      } while (next && !this.stopped);
      if (total > 0) this.logger.log(`Deleted ${total} expired whiteboards`);
      return total;
    } finally {
      this.running = false;
    }
  }
}
