import { OPEN_REPORT_STATUSES } from "./report-support.policy";

export const caseEvidenceLimit = 5;
export function casePartyCapabilities(input: {
  status: string;
  handlerId: string | null;
  ownEvidenceCount: number;
  restricted?: boolean;
}) {
  let common: string | null = null;
  if (input.restricted) common = "SKILL_PERMISSION_REQUIRED";
  else if (!OPEN_REPORT_STATUSES.includes(input.status))
    common = "REPORT_CASE_CLOSED";
  const messageBlockedReason =
    common ?? (input.handlerId ? null : "CASE_HANDLER_REQUIRED");
  const evidenceBlockedReason =
    common ??
    (input.ownEvidenceCount >= caseEvidenceLimit
      ? "CASE_EVIDENCE_LIMIT"
      : null);
  return {
    hasHandler: Boolean(input.handlerId),
    canSendMessage: messageBlockedReason === null,
    messageBlockedReason,
    canAttachEvidence: evidenceBlockedReason === null,
    evidenceBlockedReason,
    ownEvidenceCount: input.ownEvidenceCount,
  };
}
