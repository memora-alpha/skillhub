import type { AuthenticatedIdentity } from "../authentication/authenticated-identity";
import type { PermissionCode } from "./permission.catalog";

export type RoleCode = "USER" | "STAFF" | "ADMIN";
export type AccountStatus =
  "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "LOCKED" | "DEACTIVATED";

export type Actor = {
  userId: string;
  accountStatus: AccountStatus;
  roles: readonly RoleCode[];
  permissions: ReadonlySet<PermissionCode>;
  blockedPermissions: ReadonlySet<PermissionCode>;
};

export interface AuthorizationReader {
  loadActor(userId: string, now: Date): Promise<Actor | null>;
}

export const AUTHORIZATION_READER = Symbol("AUTHORIZATION_READER");

export type AuthorizedRequest = {
  authenticatedIdentity?: AuthenticatedIdentity;
  actor?: Actor;
  params?: Record<string, string>;
};
