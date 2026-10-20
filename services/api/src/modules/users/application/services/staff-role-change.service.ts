import {
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

import { ReauthProofService } from "../../../auth/application/services/reauth-proof.service";
@Injectable()
export class StaffRoleChangeService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly auth: ReauthProofService,
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
    add: boolean,
    proof: string,
    reason: string,
  ) {
    await lockUsers(tx, [principal.userId, userId]);
    const live = await this.sessions.assertLive(tx, principal);
    this.permitted(live, "roles.staff.assign", true);
    const target = await this.users.byId(tx, userId);
    if (!target) throw new NotFoundException();
    await this.auth.consumeReauth(tx, live, proof);
    const changed = await this.users.role(
      tx,
      userId,
      "STAFF",
      add,
      live.userId,
    );
    await this.audit.append(tx, {
      actorId: live.userId,
      actorRole: "ADMIN",
      action: add ? "STAFF_ASSIGNED" : "STAFF_REMOVED",
      targetType: "User",
      targetId: userId,
      reason,
      after: { changed, staff: add },
    });
  }
}
