import { UsersRepository } from "../ports/users-repository";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";

import { ProfileReader } from "../services/profile-reader.service";
import { ProfileChange } from "../contracts/profile-change";
import { ContentModerationService } from "../../../content-moderation/application/content-moderation.service";
import { moderateText } from "../../../content-moderation/application/text-moderation";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
@Injectable()
export class UpdateProfileUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: UsersRepository,
    private readonly profiles: ProfileReader,
    private readonly moderation: ContentModerationService,
    private readonly sessions: SessionsService,
  ) {}
  async execute(owner: string | Principal, data: ProfileChange) {
    const actor = typeof owner === "string" ? undefined : owner;
    const userId = typeof owner === "string" ? owner : owner.userId;
    data = { ...data };
    const fields = [data.fullName, data.headline, data.bio];
    const check = this.moderation && fields.some((value) => value?.trim());
    if (check) {
      if (actor) await this.sessions.assertLive(this.db, actor);
      else if (!(await this.repository.byId(this.db, userId)))
        throw new NotFoundException();
      await moderateText(this.moderation, "profile", {
        sourceVersion: "profile-patch:1",
        fields,
      });
    }
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [userId]);
      if (check && actor) await this.sessions.assertLive(tx, actor);
      const current = await this.repository.byId(tx, userId);
      if (data.bio !== undefined && current?.profileModeration) {
        const moderation = {
          ...(current.profileModeration as Record<string, never>),
        };
        delete moderation.bio;
        await tx.user.update({
          where: { id: userId },
          data: { profileModeration: moderation },
        });
      }
      await this.repository.updateProfile(tx, userId, data);
    });
    return this.profiles.profile(userId);
  }
}
