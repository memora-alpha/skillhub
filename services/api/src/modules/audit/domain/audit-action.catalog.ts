import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type {
  AuditInput,
  AuditSnapshot,
} from "../application/contracts/audit.types";
import {
  isConfigurationKey,
  parseConfigurationValue,
} from "../../system-configuration/domain/configuration.catalog";
import { validateReason } from "./reason.policy";

export const AUDIT_ACTIONS = [
  "TAG_CREATE",
  "TAG_UPDATE",
  "TAG_REQUEST_CREATE",
  "TAG_REQUEST_APPROVE",
  "TAG_REQUEST_REJECT",
  "SKILL_LEVEL_UPDATE",
  "PROPOSAL_CREATE",
  "PROPOSAL_UPDATE",
  "PROPOSAL_DECIDE",
  "SKILL_CATALOG_CREATE",
  "SKILL_CATALOG_UPDATE",
  "SKILL_CATALOG_ARCHIVE",
  "SKILL_CATALOG_RESTORE",
  "SHARING_SKILL_RESTORE",
  "USER_LOCK",
  "USER_UNLOCK",
  "USER_SUSPEND",
  "VERIFY_SKILL_APPROVE",
  "VERIFY_SKILL_REJECT",
  "VERIFY_SKILL_REVOKE",
  "VERIFY_SKILL_AI_REQUEST",
  "LEARNING_REQUEST_MODERATE",
  "ROLE_PERMISSION_CHANGE",
  "DISPUTE_RESOLVE",
  "REPORT_CASE_UPDATE",
  "REPORT_EVIDENCE_READ",
  "REPUTATION_ADJUST",
  "USER_RESTRICTION_APPLY",
  "USER_RESTRICTION_REVOKE",
  "SCHEDULE_RESCHEDULE",
  "CREDIT_ADJUST",
  "CREDIT_TOP_UP",
  "PAYMENT_RECOVERY_RESUME",
  "CREDIT_REVERSE",
  "SYSTEM_CONFIGURATION_UPDATE",
  "MATERIAL_MODERATE",
  "MATERIAL_PURCHASE",
  "MATERIAL_REFUND",
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
const tagLabel = z
  .string()
  .refine((value) => [...value].length >= 1 && [...value].length <= 80);
const tag = z.strictObject({
  label: tagLabel,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  version: z.number().int().positive(),
  createdByUserId: uuid.nullable(),
});
const tagRequest = z.strictObject({
  label: tagLabel,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  version: z.number().int().positive(),
  requestedByUserId: uuid,
  reviewedByUserId: uuid.nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  resultTagId: uuid.nullable(),
  rejectReason: z.string().nullable(),
});
const sharingSkill = z.strictObject({
  archivedAt: z.iso.datetime().nullable(),
  isVisible: z.boolean(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
  version: z.number().int().positive(),
});
const learningRequest = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  requestVersion: z.number().int().positive(),
  proposedTags: z.array(tagLabel).max(10).optional(),
  tagIds: z.array(uuid).max(10).optional(),
});
const rolePermission = z.strictObject({
  roles: z.array(role).optional(),
  permissions: z.array(z.string().max(128)).optional(),
});
const dispute = z.strictObject({
  status: z.enum(["OPEN", "RESOLVED", "REJECTED", "ESCALATED"]).optional(),
});
const reportCase = z.strictObject({
  status: z.enum([
    "OPEN",
    "UNDER_REVIEW",
    "NEED_MORE_INFO",
    "RESOLVED",
    "REJECTED",
  ]),
});
const reportEvidenceRead = z.strictObject({
  caseId: uuid,
  access: z.literal("READ"),
});
const reputation = z.strictObject({ score: z.number().finite() });
const userRestrictions = z.strictObject({
  score: z.number().int().min(0).max(100).optional(),
  restrictions: z
    .array(
      z.strictObject({
        scope: z.enum([
          "CREATE_NEW_ACTIVITY",
          "REQUIRE_STAFF_REVIEW",
          "REQUIRE_ADMIN_REVIEW",
        ]),
        endsAt: z.iso.datetime(),
      }),
    )
    .max(10),
});
const reschedule = z.strictObject({
  appliedVersion: z.number().int().positive(),
  sessions: z
    .array(
      z.strictObject({
        sessionId: uuid,
        startAt: z.iso.datetime(),
        endAt: z.iso.datetime(),
      }),
    )
    .max(100),
});
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
const material = z.strictObject({
  status: z.enum([
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ]),
  listingVersion: z.number().int().positive(),
});
const materialOrder = z.strictObject({
  materialId: uuid,
  grossCredit: z.string().regex(/^[1-9]\d*$/),
  feeAmount: z.string().regex(/^(0|[1-9]\d*)$/),
  operationId: uuid,
});
const materialRefund = z.strictObject({
  grossCredit: z.string().regex(/^[1-9]\d*$/),
  operationId: uuid,
});

const projectionByAction: Record<
  Exclude<AuditAction, "SYSTEM_CONFIGURATION_UPDATE">,
  z.ZodType
> = {
  TAG_CREATE: tag,
  TAG_UPDATE: tag,
  TAG_REQUEST_CREATE: tagRequest,
  TAG_REQUEST_APPROVE: tagRequest,
  TAG_REQUEST_REJECT: tagRequest,
  SKILL_LEVEL_UPDATE: z.strictObject({
    skillId: uuid,
    code: z.string().max(40),
    name: z.string().max(100),
    description: z.string().max(500).nullable(),
    sortOrder: z.number().int().min(0).max(100000),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    version: z.number().int().positive(),
  }),
  PROPOSAL_CREATE: z.strictObject({
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]),
    version: z.number().int().positive(),
  }),
  PROPOSAL_UPDATE: z.strictObject({
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]),
    version: z.number().int().positive(),
  }),
  PROPOSAL_DECIDE: z.strictObject({
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]),
    version: z.number().int().positive(),
  }),
  SKILL_CATALOG_CREATE: catalog,
  SKILL_CATALOG_UPDATE: catalog,
  SKILL_CATALOG_ARCHIVE: catalog,
  SKILL_CATALOG_RESTORE: catalog,
  SHARING_SKILL_RESTORE: sharingSkill,
  USER_LOCK: account,
  USER_UNLOCK: account,
  USER_SUSPEND: account,
  VERIFY_SKILL_APPROVE: verification,
  VERIFY_SKILL_REJECT: verification,
  VERIFY_SKILL_REVOKE: verification,
  VERIFY_SKILL_AI_REQUEST: z.strictObject({
    analysisId: uuid,
    status: z.enum([
      "QUEUED",
      "PROCESSING",
      "SUCCEEDED",
      "FAILED",
      "STALE",
      "UNSUPPORTED",
    ]),
  }),
  LEARNING_REQUEST_MODERATE: learningRequest,
  ROLE_PERMISSION_CHANGE: rolePermission,
  DISPUTE_RESOLVE: dispute,
  REPORT_CASE_UPDATE: reportCase,
  REPORT_EVIDENCE_READ: reportEvidenceRead,
  REPUTATION_ADJUST: reputation,
  USER_RESTRICTION_APPLY: userRestrictions,
  USER_RESTRICTION_REVOKE: userRestrictions,
  SCHEDULE_RESCHEDULE: reschedule,
  CREDIT_ADJUST: credit,
  CREDIT_TOP_UP: credit,
  PAYMENT_RECOVERY_RESUME: z.strictObject({
    status: z.enum(["REVIEW", "CREATED"]),
    reasonCode: z.string().max(80).nullable(),
    version: z.number().int().positive(),
  }),
  CREDIT_REVERSE: credit,
  MATERIAL_MODERATE: material,
  MATERIAL_PURCHASE: materialOrder,
  MATERIAL_REFUND: materialRefund,
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
