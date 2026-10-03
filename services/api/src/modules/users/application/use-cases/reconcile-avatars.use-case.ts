import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { AvatarRepository } from "../ports/avatar-repository";
import { AvatarStoragePort, AvatarJobs } from "../ports/avatar-providers";

@Injectable()
export class ReconcileAvatarsUseCase {
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly repository: AvatarRepository,
    private readonly storage: AvatarStoragePort,
    private readonly jobs: AvatarJobs,
  ) {}
  async execute() {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.repository.pending(this.db);
      for (const asset of pending) await this.jobs.enqueue(asset.id);
      const old = await this.repository.unreferencedExpired(this.db);
      for (const asset of old) {
        await this.storage.remove(asset.storageKey);
        await this.repository.change(this.db, asset.id, {
          state: "DELETED",
          expiresAt: null,
        });
      }
    } finally {
      this.running = false;
    }
  }
}
