import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { IdentityEmailRepository } from "../ports/identity-email-repository";
import { IdentityEmailJobs } from "../ports/identity-email-providers";

@Injectable()
export class ReconcileIdentityEmailsUseCase {
  private reconciling = false;
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly repository: IdentityEmailRepository,
    private readonly jobs: IdentityEmailJobs,
  ) {}
  async execute() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      await this.repository.recoverLeases(this.db);
      await this.repository.expire(this.db);
      await this.repository.purgeTerminal(
        this.db,
        new Date(Date.now() - this.config.deliveryRetentionSeconds * 1000),
      );
      const rows = await this.repository.due(this.db);
      for (const row of rows) await this.jobs.enqueue(row.id, row.attempts);
    } finally {
      this.reconciling = false;
    }
  }
}
