import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  IdentityTx,
  lockUsers,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "./users.service";
import {
  Principal,
  SessionsService,
} from "../../../auth/application/services/sessions.service";

import { AuditService } from "../../../audit/application/services/audit.service";

@Injectable()
export class AccountModerationService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}
  private permitted(principal: Principal, permission: string, admin = false) {
    if (
      !principal.permissions.includes(permission) ||
      (admin && !principal.roles.includes("ADMIN"))
    )
      throw new ForbiddenException();
  }
  async execute(
    tx: IdentityTx,
    principal: Principal,
    userId: string,
    locked: boolean,
    reason: string,
  ) {
    await lockUsers(tx, [principal.userId, userId]);
    const live = await this.sessions.assertLive(tx, principal);
    this.permitted(live, locked ? "users.lock" : "users.unlock");
    const target = await this.users.byId(tx, userId);
    if (!target) throw new NotFoundException();
    if (
      target.accountStatus !== (locked ? "ACTIVE" : "LOCKED") ||
      !target.emailVerified
    )
      throw new ConflictException("INVALID_ACCOUNT_TRANSITION");
    const next = locked ? "LOCKED" : "ACTIVE";
    await this.users.status(tx, userId, next);
    if (locked) await this.sessions.revoke(tx, userId, "ACCOUNT_LOCKED");
    await this.audit.append(tx, {
      actorId: live.userId,
      actorRole: live.roles.includes("ADMIN") ? "ADMIN" : "STAFF",
      action: locked ? "ACCOUNT_LOCKED" : "ACCOUNT_UNLOCKED",
      targetType: "User",
      targetId: userId,
      reason,
      before: { accountStatus: target.accountStatus },
      after: { accountStatus: next },
    });
  }
}
