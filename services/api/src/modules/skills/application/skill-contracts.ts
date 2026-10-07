import { ConflictException } from "@nestjs/common";
import type { Principal } from "../../auth/application/services/sessions.service";
import type { RequestContext } from "../../../shared/http/request-context";
import type { JsonValue } from "../../../infrastructure/idempotency/idempotency.types";
export type SkillCommand = {
  principal: Principal;
  key: string;
  context: RequestContext;
};
export type SkillQuery = {
  q?: string;
  categoryId?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  cursor?: string;
  limit: number;
};
export function commandJson(value: object): JsonValue {
  // Normalize to JSON, removing undefined optional fields before idempotency validation.
  // structuredClone preserves undefined and would change the command contract.
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
export function uniqueConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException("SKILL_DUPLICATE");
  throw error;
}
