import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { IdentityConfig } from "../../../../configs/identity.config";
import { MediaModerationService } from "../../../content-moderation/application/media-moderation.service";
import type { ModerationAssessment } from "../../../content-moderation/application/content-moderation.service";
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
    private readonly moderation?: MediaModerationService,
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
    let assessment: ModerationAssessment | undefined;
    try {
      const bytes = await this.storage.read(asset.storageKey);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      clean =
        BigInt(bytes.length) === asset.byteSize &&
        checksum === asset.checksum &&
        (await this.inspector.inspect(bytes)) === asset.mime &&
        (await this.scanner.scan(bytes));
      if (clean && this.moderation) {
        assessment = await this.moderation.assess({
          surface: "media",
          version: id,
          digest: checksum,
          mime: asset.mime,
          bytes,
        });
        if (!assessment.observedOutcome) {
          if (assessment.outcome === "RETRY") return;
          clean = assessment.outcome === "ALLOW";
        }
      }
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
          scanEvidence: {
            clean,
            selected: false,
            ...(assessment && { moderation: assessment }),
          },
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
        scanEvidence: {
          clean: true,
          selected: true,
          ...(assessment && { moderation: assessment }),
        },
        expiresAt: null,
      });
      await this.repository.select(tx, asset.userId, id);
    });
  }
}
