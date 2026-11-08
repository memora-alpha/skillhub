import {
  BadRequestException,
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
import { ReauthProofService } from "../../../auth/application/services/reauth-proof.service";
import { AuditService } from "../../../audit/application/services/audit.service";
import { UsersService } from "./users.service";
import { StaffPermissionRepository } from "../../infrastructure/persistence/staff-permission.repository";
import { STAFF_DELEGABLE_PERMISSIONS } from "../../domain/staff-permissions";

@Injectable()
export class StaffPermissionService {
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionsService,
    private readonly reauth: ReauthProofService,
    private readonly users: UsersService,
    private readonly repository: StaffPermissionRepository,
    private readonly audit: AuditService,
  ) {}
  private async admin(tx: IdentityTx, principal: Principal) {
    const live = await this.sessions.assertLive(tx, principal);
    if (
      !live.roles.includes("ADMIN") ||
      !live.permissions.includes("staff-permissions:manage")
    )
      throw new ForbiddenException("STAFF_PERMISSION_MANAGEMENT_REQUIRED");
    return live;
  }
  private async staff(tx: IdentityTx, userId: string) {
    const target = await this.repository.target(tx, userId);
    if (!target) throw new NotFoundException("USER_NOT_FOUND");
    if (target.roleIdRecord.code !== "STAFF")
      throw new ConflictException("TARGET_NOT_STAFF");
    return target;
  }
  catalog(principal: Principal) {
    return transaction(this.db, async (tx) => {
      await this.admin(tx, principal);
      return this.repository.catalog(tx, STAFF_DELEGABLE_PERMISSIONS);
    });
  }
  read(principal: Principal, userId: string) {
    return transaction(this.db, async (tx) => {
      await this.admin(tx, principal);
      await lockUsers(tx, [principal.userId, userId]);
      await this.admin(tx, principal);
      const target = await this.staff(tx, userId);
      const grants = await this.users.grants(tx, userId);
      const overrides = await this.repository.list(tx, userId);
      return {
        userId,
        version: target.staffPermissionVersion,
        effectivePermissions: grants.permissions,
        overrides: overrides.map((row) => ({
          code: row.permission.code,
          effect: row.effect,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        })),
      };
    });
  }
  change(
    principal: Principal,
    userId: string,
    code: string,
    input: {
      effect: "GRANT" | "DENY" | "RESET";
      expectedVersion: number;
      reason: string;
      reauthToken: string;
    },
  ) {
    if (!(STAFF_DELEGABLE_PERMISSIONS as readonly string[]).includes(code))
      throw new BadRequestException("PERMISSION_NOT_DELEGABLE");
    if (
      !["GRANT", "DENY", "RESET"].includes(input.effect) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      typeof input.reason !== "string" ||
      !input.reason.trim() ||
      input.reason.length > 1000
    )
      throw new BadRequestException("INVALID_PERMISSION_CHANGE");
    return transaction(this.db, async (tx) => {
      await this.admin(tx, principal);
      await lockUsers(tx, [principal.userId, userId]);
      const live = await this.admin(tx, principal);
      const target = await this.staff(tx, userId);
      if (target.staffPermissionVersion !== input.expectedVersion)
        throw new ConflictException("STALE_STAFF_PERMISSION_VERSION");
      await this.reauth.consumeReauth(tx, live, input.reauthToken);
      const before = await this.repository.list(tx, userId);
      const updated = await this.repository.change(
        tx,
        userId,
        code,
        input.effect,
        live.userId,
      );
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: "STAFF_PERMISSION_CHANGE",
        targetType: "User",
        targetId: userId,
        reason: input.reason.trim(),
        before: {
          code,
          effect:
            before.find((row) => row.permission.code === code)?.effect ?? null,
          version: target.staffPermissionVersion,
        },
        after: {
          code,
          effect: input.effect,
          version: updated.staffPermissionVersion,
        },
      });
      return { userId, version: updated.staffPermissionVersion };
    });
  }
}
