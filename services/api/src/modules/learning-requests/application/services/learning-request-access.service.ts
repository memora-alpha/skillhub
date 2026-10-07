import { ForbiddenException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SessionsService } from "../../../auth/application/services/sessions.service";

@Injectable()
export class LearningRequestAccessService {
  constructor(private readonly sessions: SessionsService) {}

  async assertAction(
    tx: TransactionContext,
    principal: Principal,
    permission: PermissionCode,
  ): Promise<Principal> {
    const live = await this.sessions.assertLive(tx, principal);
    if (!live.permissions.includes(permission)) throw new ForbiddenException();
    return live;
  }

  async assertAnyAction(
    tx: TransactionContext,
    principal: Principal,
    permissions: readonly PermissionCode[],
  ): Promise<Principal> {
    const live = await this.sessions.assertLive(tx, principal);
    if (
      !permissions.some((permission) => live.permissions.includes(permission))
    ) {
      throw new ForbiddenException();
    }
    return live;
  }

  async assertUserAction(
    tx: TransactionContext,
    principal: Principal,
    permission: PermissionCode,
  ): Promise<Principal> {
    const live = await this.assertAction(tx, principal, permission);
    if (!live.roles.includes("USER")) throw new ForbiddenException();
    return live;
  }
}
