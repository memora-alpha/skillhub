import { SetMetadata, type Type } from "@nestjs/common";
import type { Actor } from "./authorization.types";
import type { PermissionCode } from "./permission.catalog";

export interface ResourceAccessResolver {
  check(input: {
    actor: Actor;
    resourceId: string;
    operation: PermissionCode;
  }): Promise<"allow" | "deny" | "not_found">;
}

export type ResourcePolicy = {
  resolver: Type<ResourceAccessResolver>;
  idParam: string;
  operation: PermissionCode;
};

export const RESOURCE_POLICY = Symbol("RESOURCE_POLICY");
export const CheckResource = (policy: ResourcePolicy) =>
  SetMetadata(RESOURCE_POLICY, policy);
