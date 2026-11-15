import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

@Injectable()
export class MaterialDownloadGrantRecovery
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MaterialDownloadGrantRecovery.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<number>;

  constructor(private readonly db: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.expire()
        .catch(() => {
          this.logger.error("Material download grant recovery failed");
          return 0;
        })
        .finally(() => {
          this.running = undefined;
        });
    }, 60_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => 0);
  }

  expire(): Promise<number> {
    return this.db.$executeRaw`
      UPDATE material_download_grants
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP
    `;
  }
}
