import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ReconcileIdentityEmailsUseCase } from "../../application/use-cases/reconcile-identity-emails.use-case";
@Injectable()
export class IdentityEmailScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(IdentityEmailScheduler.name);
  constructor(private readonly reconcile: ReconcileIdentityEmailsUseCase) {}
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
