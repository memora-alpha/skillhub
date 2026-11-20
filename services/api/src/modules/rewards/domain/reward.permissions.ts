import type { RoleCode } from "../../../generated/prisma/client";
import type { PermissionCode } from "../../../shared/authorization/permission.catalog";

export const REWARD_PERMISSIONS = {
  USER: ["reward:redeem"],
  STAFF: ["reward:redeem", "reward:manage"],
  ADMIN: ["reward:redeem", "reward:manage"],
} satisfies Record<RoleCode, readonly PermissionCode[]>;
