import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Actor } from "../../../../shared/authorization/authorization.types";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";

@Injectable()
export class SkillActorService {
  constructor(private readonly sessions: SessionsService) {}
  async require(
    tx: TransactionContext,
    principal: Principal,
    permission?: string,
    otherUsers: string[] = [],
  ): Promise<Actor> {
    await lockUsers(tx, [principal.userId, ...otherUsers]);
    const live = await this.sessions.assertLive(tx, principal);
    const now = new Date();
    const restrictions = await tx.userRestriction.findMany({
      where: {
        userId: principal.userId,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    const blocked = new Set(restrictions.map((row) => row.scope));
    if (blocked.has("ALL"))
      throw new ForbiddenException("SKILL_PERMISSION_REQUIRED");
    if (
      permission &&
      (!live.permissions.includes(permission) ||
        blocked.has(permission) ||
        blocked.has("ALL"))
    )
      throw new ForbiddenException("SKILL_PERMISSION_REQUIRED");
    return {
      userId: live.userId,
      accountStatus: "ACTIVE",
      roles: live.roles as Actor["roles"],
      permissions: new Set(live.permissions as PermissionCode[]),
      blockedPermissions: new Set([...blocked] as PermissionCode[]),
    };
  }
  async counter(
    tx: TransactionContext,
    userId: string,
    count: number,
  ): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: { verifiedSkillCount: count },
    });
  }
}
