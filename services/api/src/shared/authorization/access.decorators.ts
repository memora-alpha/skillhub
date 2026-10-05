import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "./permission.catalog";

export const PUBLIC_ACCESS = Symbol("PUBLIC_ACCESS");
export const AUTHENTICATED_ACCESS = Symbol("AUTHENTICATED_ACCESS");
export const REQUIRED_PERMISSIONS = Symbol("REQUIRED_PERMISSIONS");

export const Public = () => SetMetadata(PUBLIC_ACCESS, true);
export const Authenticated = () => SetMetadata(AUTHENTICATED_ACCESS, true);
export const RequirePermissions = (...codes: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, codes);
