import type { Principal } from "../../modules/auth/application/services/sessions.service";
import type { Actor, RoleCode } from "./authorization.types";
import type { PermissionCode } from "./permission.catalog";

export function roleCodes(principal: Principal): RoleCode[] {
  return principal.roles.filter(
    (role): role is RoleCode =>
      role === "USER" || role === "STAFF" || role === "ADMIN",
  );
}

/** The file-storage actor for an authenticated principal (active by construction). */
export function storageActor(principal: Principal): Actor {
  return {
    userId: principal.userId,
    accountStatus: "ACTIVE",
    roles: roleCodes(principal),
    permissions: new Set(principal.permissions as PermissionCode[]),
    blockedPermissions: new Set(),
  };
}
