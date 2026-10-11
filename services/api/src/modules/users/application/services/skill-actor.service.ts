import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
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
  async assertConnectionParty(tx: TransactionContext, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const now = new Date();
    const restriction = await tx.userRestriction.findFirst({
      where: {
        userId,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
        scope: "ALL",
      },
    });
    if (
      !user ||
      user.accountStatus !== "ACTIVE" ||
      !user.emailVerified ||
      restriction
    )
      throw new ConflictException("CONNECTION_PARTY_UNAVAILABLE");
  }
  async assertAllowed(
    tx: TransactionContext,
    userId: string,
    _action: "CREATE_LEARNING_REQUEST" | "PUBLISH_LEARNING_REQUEST",
  ) {
    void _action;
    await this.assertConnectionParty(tx, userId);
    const now = new Date();
    if (
      await tx.userRestriction.findFirst({
        where: {
          userId,
          revokedAt: null,
          startsAt: { lte: now },
          endsAt: { gt: now },
          scope: { in: ["learning-request:create", "CREATE_NEW_ACTIVITY"] },
        },
      })
    )
      throw new ForbiddenException("NEW_ACTIVITY_RESTRICTED");
  }
  async readPublicOwners(tx: TransactionContext, userIds: readonly string[]) {
    const rows = await tx.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, fullName: true },
    });
    return rows.map((row) => ({ id: row.id, displayName: row.fullName }));
  }
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
