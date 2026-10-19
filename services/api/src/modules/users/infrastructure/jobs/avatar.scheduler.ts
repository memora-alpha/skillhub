import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ReconcileAvatarsUseCase } from "../../application/use-cases/reconcile-avatars.use-case";
@Injectable()
export class AvatarScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(AvatarScheduler.name);
  constructor(private readonly reconcile: ReconcileAvatarsUseCase) {}
  onModuleInit() {
    const run = () => {
      void this.reconcile
        .execute()
        .catch(() =>
          this.logger.error(
            "Reconciliation failed; durable records will retry",
          ),
        );
    };
    this.timer = setInterval(run, 5000);
    this.timer.unref();
    run();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
