import type { RoleCode } from "../../../generated/prisma/client";
import type { PermissionCode } from "../../../shared/authorization/permission.catalog";

/** Spec 021 contracts: self-service for everyone, read for Staff, plan changes for Admin. */
export const SUBSCRIPTION_PERMISSIONS = {
  USER: ["subscription:manage:self"],
  STAFF: ["subscription:manage:self", "subscription:read"],
  ADMIN: [
    "subscription:manage:self",
    "subscription:read",
    "subscription:manage",
  ],
} satisfies Record<RoleCode, readonly PermissionCode[]>;
