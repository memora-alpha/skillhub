import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PublicSkillReader } from "./public-skill-reader";
import { PublicReviewReader } from "./public-review-reader";
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
    @Optional() private readonly reviews?: PublicReviewReader,
  ) {}
  async profile(userId: string, publicOnly = false) {
    const row = await this.repository.profile(this.db, userId);
    if (!row || (publicOnly && row.user.accountStatus !== "ACTIVE"))
      throw new NotFoundException();
    const bioModeration = (
      row.profileModeration as { bio?: { action?: string } } | null
    )?.bio;
    const projection = {
      userId,
      fullName: row.fullName,
      headline: row.headline ?? "",
      bio:
        publicOnly && bioModeration?.action === "HIDE" ? "" : (row.bio ?? ""),
      avatarUrl:
        row.avatarAsset?.state === "CLEAN"
          ? await this.storage.url(row.avatarAsset.storageKey)
          : null,
      reputationScore: row.reputationScore,
      verifiedSkillCount: row.verifiedSkillCount,
      completedSessionCount: row.completedSessionCount,
      completedLearningPathCount: await this.db.learningPath.count({
        where: {
          status: "COMPLETED",
          settledAt: { not: null },
          OR: [{ participantAId: userId }, { participantBId: userId }],
        },
      }),
      selectedTitle: row.selectedTitle,
      ...(this.reviews
        ? { reviewSummary: await this.reviews.read(userId) }
        : {}),
      ...(this.skills ? { sharingSkills: await this.skills.read(userId) } : {}),
    };
    // URLs are supplied by the storage adapter/controller, never a quarantine key.
    return publicOnly
      ? projection
      : {
          ...projection,
          profileModeration: row.profileModeration ?? null,
          timezone: row.timezone,
          locale: row.locale,
        };
  }
}
