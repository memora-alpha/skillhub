import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { RedemptionService } from "../../application/services/redemption.service";

/** Durable ISSUING rows are the queue; SKIP LOCKED claims let several API instances share it. */
@Injectable()
export class RedemptionReconcileWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(RedemptionReconcileWorker.name);

  constructor(private readonly redemptions: RedemptionService) {}

  onModuleInit() {
    if (!this.redemptions.enabled()) return;
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.redemptions.reconcileDue();
    } catch {
      this.logger.error("VOUCHER_RECONCILE_UNAVAILABLE");
      return 0;
    } finally {
      this.running = false;
    }
  }
}
