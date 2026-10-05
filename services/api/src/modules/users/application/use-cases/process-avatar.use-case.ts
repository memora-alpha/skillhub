import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { IdentityConfig } from "../../../../configs/identity.config";
import { AvatarRepository } from "../ports/avatar-repository";
import {
  AvatarStoragePort,
  AvatarScannerPort,
  AvatarInspector,
} from "../ports/avatar-providers";

@Injectable()
export class ProcessAvatarUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: AvatarRepository,
    private readonly storage: AvatarStoragePort,
    private readonly scanner: AvatarScannerPort,
    private readonly inspector: AvatarInspector,
    private readonly config: IdentityConfig,
  ) {}
  async execute(id: string) {
    const found = await this.repository.find(this.db, id);
    if (found?.state !== "QUARANTINED") return;
    const asset = await transaction(this.db, async (tx) => {
      await lockUsers(tx, [found.userId]);
      const row = await this.repository.required(tx, id);
      const evidence = row.scanEvidence as {
        lease?: number;
        attempts?: number;
      } | null;
      if (row.state !== "QUARANTINED" || (evidence?.lease ?? 0) > Date.now())
        return null;
      const attempts = (evidence?.attempts ?? 0) + 1;
      if (
        attempts > this.config.deliveryAttempts ||
        (row.expiresAt && row.expiresAt <= new Date())
      ) {
        await this.repository.change(tx, id, {
          state: "REJECTED",
          scanEvidence: { reason: "SCAN_EXHAUSTED", attempts },
          expiresAt: new Date(),
        });
        return null;
      }
      const lease = Date.now() + 60000;
      return this.repository.change(tx, id, {
        scanEvidence: { lease, attempts },
      });
    });
    if (!asset) return;
    let clean: boolean;
    try {
      const bytes = await this.storage.read(asset.storageKey);
      clean =
        bytes.length === asset.byteSize &&
        (await this.inspector.inspect(bytes)) === asset.mime &&
        (await this.scanner.scan(bytes));
    } catch {
      return;
    } // Lease expires and durable metadata retries; fail closed.
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [asset.userId]);
      const current = await this.repository.required(tx, id);
      if (
        current.state !== "QUARANTINED" ||
        JSON.stringify(current.scanEvidence) !==
          JSON.stringify(asset.scanEvidence)
      )
        return;
      const latest = await this.repository.latest(tx, asset.userId);
      const user = await this.repository.requiredUser(tx, asset.userId);
      if (!clean || latest?.id !== id || user.accountStatus !== "ACTIVE") {
        await this.repository.change(tx, id, {
          state: "REJECTED",
          checkedAt: new Date(),
          scanEvidence: { clean, selected: false },
          expiresAt: new Date(),
        });
        return;
      }
      const profile = await this.repository.profile(tx, asset.userId);
      if (profile.avatarAssetId)
        await this.repository.change(tx, profile.avatarAssetId, {
          state: "DELETED",
          expiresAt: new Date(),
        });
      await this.repository.change(tx, id, {
        state: "CLEAN",
        checkedAt: new Date(),
        scanEvidence: { clean: true, selected: true },
        expiresAt: null,
      });
      await this.repository.select(tx, asset.userId, id);
    });
  }
}
