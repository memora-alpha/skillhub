import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ObjectStorage } from "./object-storage.port";
import type { ReconciliationRepository } from "./reconciliation-repository.port";

const UPLOAD_GRACE_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class FileReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileReconciler.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;

  constructor(
    private readonly repository: ReconciliationRepository,
    private readonly objects: Pick<ObjectStorage, "remove">,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>("STORAGE_ENABLED")) return;
    this.timer = setInterval(() => {
      if (this.active) return;
      this.active = this.runOnce()
        .then(() => undefined)
        .catch(() => this.logger.error("File reconciliation failed"))
        .finally(() => {
          this.active = undefined;
        });
    }, 60_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }

  async runOnce(): Promise<{ cleaned: number; scansRecovered: number }> {
    const scansRecovered = await this.repository.reconcileExpiredScans(20);
    const candidates = await this.repository.claimCleanup(
      new Date(Date.now() - UPLOAD_GRACE_MS),
      20,
    );
    let cleaned = 0;
    for (const candidate of candidates) {
      try {
        await this.objects.remove(candidate.objectKey);
        await this.repository.markDeleted(candidate.id);
        cleaned++;
      } catch {
        this.logger.warn("File cleanup deferred");
      }
    }
    return { cleaned, scansRecovered };
  }
}
