import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { AvatarStorage } from "../../../../infrastructure/storage/avatar-storage";
import { UsersRepository } from "../ports/users-repository";

@Injectable()
export class ProfileReader {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: UsersRepository,
    private readonly storage: AvatarStorage,
  ) {}
  async profile(userId: string, publicOnly = false) {
    const row = await this.repository.profile(this.db, userId);
    if (!row || (publicOnly && row.user.accountStatus !== "ACTIVE"))
      throw new NotFoundException();
    const projection = {
      userId,
      fullName: row.fullName,
      headline: row.headline,
      bio: row.bio,
      avatarUrl:
        row.avatarAsset?.state === "CLEAN"
          ? await this.storage.url(row.avatarAsset.storageKey)
          : null,
      reputationScore: row.reputationScore,
      verifiedSkillCount: row.verifiedSkillCount,
      completedSessionCount: row.completedSessionCount,
    };
    // URLs are supplied by the storage adapter/controller, never a quarantine key.
    return publicOnly
      ? projection
      : { ...projection, timezone: row.timezone, locale: row.locale };
  }
}
