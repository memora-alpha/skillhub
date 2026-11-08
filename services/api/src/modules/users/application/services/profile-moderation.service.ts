import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
  type IdentityTx,
} from "../../../../shared/database/identity-transactions";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import { AuditService } from "../../../audit/application/services/audit.service";
import { AvatarStorage } from "../../../../infrastructure/storage/avatar-storage";
import { validateReason } from "../../../audit/domain/reason.policy";
import type { Prisma } from "../../../../generated/prisma/client";
@Injectable()
export class ProfileModerationService {
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly storage: AvatarStorage,
  ) {}
  private async authorize(tx: IdentityTx, actor: Principal, userId: string) {
    const live = await this.sessions.assertLive(tx, actor);
    if (
      !live.roles.some((role) => role === "ADMIN" || role === "STAFF") ||
      !live.permissions.includes("profile:moderate")
    )
      throw new ForbiddenException("PROFILE_MODERATION_REQUIRED");
    if (live.userId === userId)
      throw new ForbiddenException("PROFILE_SELF_MODERATION_FORBIDDEN");
    return live;
  }
  async read(actor: Principal, userId: string) {
    const user = await transaction(this.db, async (tx) => {
      await this.authorize(tx, actor, userId);
      const target = await tx.user.findUnique({
        where: { id: userId },
        include: { selectedAvatarRecord: true },
      });
      if (!target) throw new NotFoundException("USER_NOT_FOUND");
      return target;
    });
    const avatarUrl =
      user.selectedAvatarRecord?.state === "CLEAN"
        ? await this.storage.url(user.selectedAvatarRecord.storageKey)
        : null;
    return {
      userId,
      updatedAt: user.updatedAt,
      bio: user.bio,
      avatarUrl,
      moderation: user.profileModeration,
    };
  }

  change(
    actor: Principal,
    userId: string,
    input: {
      field: "BIO" | "AVATAR";
      action: "HIDE" | "REQUEST_EDIT";
      expectedUpdatedAt: string;
      reason: string;
    },
  ) {
    const reason = validateReason(input.reason, { min: 3, max: 1000 });
    return transaction(this.db, async (tx) => {
      await this.authorize(tx, actor, userId);
      await lockUsers(tx, [actor.userId, userId]);
      const live = await this.authorize(tx, actor, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException("USER_NOT_FOUND");
      if (user.updatedAt.toISOString() !== input.expectedUpdatedAt)
        throw new ConflictException("STALE_PROFILE_VERSION");
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!clock?.now) throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const moderation = {
        ...((user.profileModeration as Prisma.JsonObject) ?? {}),
        [input.field.toLowerCase()]: {
          action: input.action,
          reason,
          at: clock.now.toISOString(),
        },
      };
      if (input.field === "AVATAR" && input.action === "HIDE") {
        // Cancel quarantined uploads too: a delayed scanner must not restore the hidden avatar.
        await tx.avatarAsset.updateMany({
          where: { userId, state: { in: ["CLEAN", "QUARANTINED"] } },
          data: { state: "DELETED", expiresAt: clock.now },
        });
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          profileModeration: moderation,
          ...(input.action === "HIDE" && input.field === "AVATAR"
            ? { avatarAssetId: null }
            : {}),
        },
      });
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: live.roles.includes("ADMIN") ? "ADMIN" : "STAFF",
        action: "PROFILE_" + input.action,
        targetType: "User",
        targetId: userId,
        reason,
        before: { field: input.field, updatedAt: user.updatedAt.toISOString() },
        after: {
          field: input.field,
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
      return {
        userId,
        updatedAt: updated.updatedAt,
        moderation: updated.profileModeration,
      };
    });
  }
}
