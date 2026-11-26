import type { Prisma } from "../../generated/prisma/client";

export const chatAttachmentOriginKey = "CHAT_ATTACHMENT_POST_MODERATION_ORIGIN";

type AttachmentState = {
  state: string;
  scanVerdict: string | null;
  generation: number;
  sha256: string | null;
  moderationAssessment?: Prisma.JsonValue;
};

export function chatAttachmentAvailability(row: AttachmentState) {
  if (row.state === "REJECTED") return "REVOKED";
  const result = row.moderationAssessment;
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    result.sourceVersion === String(row.generation) &&
    result.digest === row.sha256 &&
    result.outcome === "BLOCK"
  )
    return "REVOKED";
  if (row.state === "QUARANTINED" || row.state === "SCANNING")
    return "PENDING_SCAN";
  if (row.state === "READY" && row.scanVerdict === "CLEAN") return "AVAILABLE";
  return "UNAVAILABLE";
}
