import type { Prisma } from "../../generated/prisma/client";
import { moderationPolicyVersion } from "../../modules/content-moderation/domain/moderation-policy";

export const chatAttachmentOriginKey = "CHAT_ATTACHMENT_POST_MODERATION_ORIGIN";
export const chatModerationRevision = 2;

type AttachmentState = {
  state: string;
  scanVerdict: string | null;
  generation: number;
  sha256: string | null;
  moderationAssessment?: Prisma.JsonValue;
};

export function chatAttachmentStatus(
  row: AttachmentState,
  profanityVersion = 1,
) {
  if (row.state === "REJECTED") return "BLOCKED";
  if (row.state === "SCAN_FAILED") return "FAILED";
  const result = row.moderationAssessment;
  if (
    row.state !== "READY" ||
    row.scanVerdict !== "CLEAN" ||
    !row.sha256 ||
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    result.sourceVersion !== String(row.generation) ||
    result.digest !== row.sha256
  )
    return "PENDING";
  if (result.outcome === "BLOCK") return "BLOCKED";
  if (
    result.policyVersion !== moderationPolicyVersion ||
    result.profanityVersion !== profanityVersion ||
    result.extractorRevision !== chatModerationRevision
  )
    return "PENDING";
  if (result.outcome === "FAILED") return "FAILED";
  if (result.outcome === "REVIEW") return "REVIEW_REQUIRED";
  return result.outcome === "ALLOW" && result.enforced === true
    ? "APPROVED"
    : "PENDING";
}

const accessStatus = {
  BLOCKED: "REVOKED",
  FAILED: "UNAVAILABLE",
  REVIEW_REQUIRED: "PENDING_SCAN",
  PENDING: "PENDING_SCAN",
  APPROVED: "AVAILABLE",
} as const;

export function chatAttachmentAvailability(
  row: AttachmentState,
  profanityVersion = 1,
) {
  return accessStatus[chatAttachmentStatus(row, profanityVersion)];
}

export function canRetryChatAttachment(row: AttachmentState) {
  if (row.state === "SCAN_FAILED") return true;
  const assessment = row.moderationAssessment;
  return (
    row.state === "READY" &&
    row.scanVerdict === "CLEAN" &&
    row.sha256 !== null &&
    !!assessment &&
    typeof assessment === "object" &&
    !Array.isArray(assessment) &&
    assessment.outcome === "FAILED" &&
    assessment.sourceVersion === String(row.generation) &&
    assessment.digest === row.sha256 &&
    Array.isArray(assessment.reasonCodes) &&
    assessment.reasonCodes.some(
      (code) =>
        typeof code === "string" &&
        (/^(MEDIA_|PROVIDER_|MODERATION_).*(TIMEOUT|UNAVAILABLE)$/u.test(
          code,
        ) ||
          ["MEDIA_STORAGE_READ_FAILED", "MEDIA_CACHE_PENDING"].includes(code)),
    )
  );
}

export function chatAttachmentRetry(assessment: Prisma.JsonValue | undefined) {
  if (
    assessment &&
    typeof assessment === "object" &&
    !Array.isArray(assessment) &&
    assessment.outcome === "PENDING" &&
    typeof assessment.retryAttemptId === "string" &&
    typeof assessment.retryQueuedAt === "number"
  )
    return {
      id: assessment.retryAttemptId,
      queuedAt: assessment.retryQueuedAt,
    };
  return undefined;
}

export function chatAttachmentRestriction(
  assessment: unknown,
  status: ReturnType<typeof chatAttachmentStatus>,
) {
  if (status !== "BLOCKED") return undefined;
  if (
    assessment &&
    typeof assessment === "object" &&
    "reasonCodes" in assessment &&
    Array.isArray(assessment.reasonCodes) &&
    assessment.reasonCodes.includes("STAFF_CONFIRMED")
  )
    return "REVOKED" as const;
  return "BLOCKED" as const;
}
