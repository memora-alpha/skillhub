import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PublicSkillReader } from "./public-skill-reader";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { AvatarStorage } from "../../../../infrastructure/storage/avatar-storage";
import { UsersRepository } from "../ports/users-repository";

@Injectable()
export class ProfileReader {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: UsersRepository,
    private readonly storage: AvatarStorage,
    @Optional() private readonly skills?: PublicSkillReader,
  ) {}
  async summaries(userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length)
      return new Map<
        string,
        { userId: string; fullName: string; avatarUrl: string | null }
      >();
    const rows = await this.repository.publicSummaries(this.db, ids);
    const summaries = await Promise.all(
      rows.map(async (row) => ({
        userId: row.id,
        fullName: row.fullName,
        avatarUrl:
          row.selectedAvatarRecord?.state === "CLEAN"
            ? await this.storage.url(row.selectedAvatarRecord.storageKey)
            : null,
      })),
    );
    return new Map(summaries.map((row) => [row.userId, row]));
  }
  async profile(userId: string, publicOnly = false) {
    const row = await this.repository.profile(this.db, userId);
    if (!row || (publicOnly && row.user.accountStatus !== "ACTIVE"))
      throw new NotFoundException();
    const projection = {
      userId,
      fullName: row.fullName,
      headline: row.headline ?? "",
      bio: row.bio ?? "",
      avatarUrl:
        row.avatarAsset?.state === "CLEAN"
          ? await this.storage.url(row.avatarAsset.storageKey)
          : null,
      reputationScore: row.reputationScore,
      verifiedSkillCount: row.verifiedSkillCount,
      completedSessionCount: row.completedSessionCount,
      selectedTitle: row.selectedTitle,
      ...(this.skills ? { sharingSkills: await this.skills.read(userId) } : {}),
    };
    // URLs are supplied by the storage adapter/controller, never a quarantine key.
    return publicOnly
      ? projection
      : { ...projection, timezone: row.timezone, locale: row.locale };
  }
}
