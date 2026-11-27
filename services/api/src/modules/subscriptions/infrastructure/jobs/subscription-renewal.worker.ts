import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { SubscriptionRenewalService } from "../../application/services/subscription-renewal.service";

const TICK_MS = 60_000;
const BATCH = 20;

/**
 * Spec 021 D6: processes due renewals every minute. It always runs, so paid terms renew and
 * expire even while new sales are switched off.
 */
@Injectable()
export class SubscriptionRenewalWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(SubscriptionRenewalWorker.name);

  constructor(private readonly renewals: SubscriptionRenewalService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Drains due rows in batches; a failing batch waits for the next tick. */
  async tick(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    let total = 0;
    try {
      let claimed: number;
      // Sequential on purpose: another batch is claimed only after a full one, and each claim
      // must see the leases the previous batch set.
      do {
        claimed = await this.renewals.renewDue(BATCH);
        total += claimed;
      } while (claimed === BATCH && !this.stopped);
      return total;
    } catch {
      this.logger.error("SUBSCRIPTION_RENEWAL_UNAVAILABLE");
      return total;
    } finally {
      this.running = false;
    }
  }
}
