import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  SessionRecordingEventsService,
  type ReconcileSummary,
} from "../../application/services/session-recording-events.service";

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Spec 020: every minute, expire unanswered requests, stop recordings at the kill switch,
 * window close or cap, and repair rows whose Egress call or webhook went missing.
 */
@Injectable()
export class SessionRecordingReconcileWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(SessionRecordingReconcileWorker.name);

  constructor(private readonly events: SessionRecordingEventsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error("RECORDING_RECONCILE_DEFERRED"),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Never overlaps; returns null when a pass is already running or the worker stopped. */
  async sweep(): Promise<ReconcileSummary | null> {
    if (this.running || this.stopped) return null;
    this.running = true;
    try {
      const summary = await this.events.reconcile();
      if (summary.stopped || summary.repaired)
        this.logger.log(
          `Recordings stopped ${summary.stopped}, repaired ${summary.repaired}`,
        );
      return summary;
    } finally {
      this.running = false;
    }
  }
}
