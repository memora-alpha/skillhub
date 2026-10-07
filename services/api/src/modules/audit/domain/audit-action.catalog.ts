import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { AuditInput, AuditSnapshot } from "../application/audit.types";
import {
  isConfigurationKey,
  parseConfigurationValue,
} from "../../system-configuration/domain/configuration.catalog";
import { validateReason } from "./reason.policy";

export const AUDIT_ACTIONS = [
  "SKILL_CATALOG_CREATE",
  "SKILL_CATALOG_UPDATE",
  "SKILL_CATALOG_ARCHIVE",
  "USER_LOCK",
  "USER_UNLOCK",
  "USER_SUSPEND",
  "VERIFY_SKILL_APPROVE",
  "VERIFY_SKILL_REJECT",
  "VERIFY_SKILL_REVOKE",
  "LEARNING_REQUEST_MODERATE",
  "ROLE_PERMISSION_CHANGE",
  "DISPUTE_RESOLVE",
  "REPUTATION_ADJUST",
  "CREDIT_ADJUST",
  "CREDIT_REVERSE",
  "SYSTEM_CONFIGURATION_UPDATE",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const role = z.enum(["USER", "STAFF", "ADMIN"]);
const uuid = z.uuid();
const actor = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("HUMAN"),
    userId: uuid,
    roles: z
      .array(role)
      .min(1)
      .refine((roles) => new Set(roles).size === roles.length),
  }),
  z.strictObject({
    kind: z.literal("SYSTEM"),
    name: z.string().trim().min(1).max(128),
  }),
]);

const auditShape = z.strictObject({
  actor,
  action: z.enum(AUDIT_ACTIONS),
  target: z.strictObject({
    type: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/),
    id: z.string().trim().min(1).max(256),
  }),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  reason: z.unknown(),
  context: z.strictObject({ requestId: uuid, correlationId: uuid }),
});

const account = z.strictObject({
  status: z
    .enum([
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "LOCKED",
      "DEACTIVATED",
    ])
    .optional(),
  roles: z.array(role).optional(),
});
const verification = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVOKED"]).optional(),
});
const catalog = z.strictObject({
  name: z.string().max(100),
  slug: z.string().max(120),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  version: z.number().int().positive(),
});
const learningRequest = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  requestVersion: z.number().int().positive(),
});
const rolePermission = z.strictObject({
  roles: z.array(role).optional(),
  permissions: z.array(z.string().max(128)).optional(),
});
const dispute = z.strictObject({
  status: z.enum(["OPEN", "RESOLVED", "REJECTED", "ESCALATED"]).optional(),
});
const reputation = z.strictObject({ score: z.number().finite() });
const credit = z.strictObject({
  amount: z
    .string()
    .regex(/^-?(0|[1-9]\d*)$/)
    .optional(),
  balanceBefore: z
    .string()
    .regex(/^(0|[1-9]\d*)$/)
    .optional(),
  balanceAfter: z
    .string()
    .regex(/^(0|[1-9]\d*)$/)
    .optional(),
  operationId: uuid.optional(),
  referenceId: z.string().max(128).optional(),
});

const projectionByAction: Record<
  Exclude<AuditAction, "SYSTEM_CONFIGURATION_UPDATE">,
  z.ZodType
> = {
  SKILL_CATALOG_CREATE: catalog,
  SKILL_CATALOG_UPDATE: catalog,
  SKILL_CATALOG_ARCHIVE: catalog,
  USER_LOCK: account,
  USER_UNLOCK: account,
  USER_SUSPEND: account,
  VERIFY_SKILL_APPROVE: verification,
  VERIFY_SKILL_REJECT: verification,
  VERIFY_SKILL_REVOKE: verification,
  LEARNING_REQUEST_MODERATE: learningRequest,
  ROLE_PERMISSION_CHANGE: rolePermission,
  DISPUTE_RESOLVE: dispute,
  REPUTATION_ADJUST: reputation,
  CREDIT_ADJUST: credit,
  CREDIT_REVERSE: credit,
};

function validateProjection(
  action: AuditAction,
  targetId: string,
  value: unknown,
): AuditSnapshot | undefined {
  if (value === undefined) return undefined;
  if (action === "SYSTEM_CONFIGURATION_UPDATE") {
    if (!isConfigurationKey(targetId))
      throw new Error("Invalid configuration key");
    const snapshot = z
      .strictObject({
        value: z.unknown(),
        version: z.number().int().positive(),
      })
      .parse(value);
    return {
      value: parseConfigurationValue(targetId, snapshot.value),
      version: snapshot.version,
    };
  }
  return projectionByAction[action].parse(value) as AuditSnapshot;
}

export function validateAuditInput(input: unknown): AuditInput {
  try {
    const parsed = auditShape.parse(input);
    if (
      parsed.action === "SYSTEM_CONFIGURATION_UPDATE" &&
      parsed.target.type !== "SYSTEM_CONFIGURATION"
    ) {
      throw new Error("Invalid configuration target");
    }
    return {
      actor: parsed.actor,
      action: parsed.action,
      target: parsed.target,
      before: validateProjection(
        parsed.action,
        parsed.target.id,
        parsed.before,
      ),
      after: validateProjection(parsed.action, parsed.target.id, parsed.after),
      reason: validateReason(
        parsed.reason,
        parsed.action === "VERIFY_SKILL_REJECT"
          ? { min: 10, max: 500 }
          : { min: 1, max: 2000 },
      ),
      context: parsed.context,
    };
  } catch {
    // Never echo raw projections or validation issues that may include secrets.
    throw new BadRequestException("Invalid audit input");
  }
}
