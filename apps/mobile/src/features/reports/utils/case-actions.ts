import type { CaseCapabilities } from "@/lib/http/case-capabilities";

export function canWriteCase(status: string | undefined, blocked = false) {
  return (
    !blocked &&
    !!status &&
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(status)
  );
}
export function canSendCaseMessage(
  status: string | undefined,
  handlerId: string | null | undefined,
  blocked = false,
) {
  return canWriteCase(status, blocked) && !!handlerId;
}

export function casePermissions(
  capabilities: CaseCapabilities | undefined,
  fallback: {
    status?: string;
    handlerId?: string | null;
    evidenceCount?: number;
  },
  blocked = false,
) {
  return {
    canSendMessage:
      !blocked &&
      (capabilities?.canSendMessage ??
        canSendCaseMessage(fallback.status, fallback.handlerId)),
    canAttachEvidence:
      !blocked &&
      (capabilities?.canAttachEvidence ??
        (canWriteCase(fallback.status) &&
          fallback.evidenceCount !== undefined &&
          fallback.evidenceCount < 5)),
  };
}

export function caseBlockedCopy(reason: string | null | undefined) {
  switch (reason) {
    case "CASE_HANDLER_REQUIRED":
      return "Chờ nhân viên tiếp nhận để gửi phản hồi.";
    case "CASE_EVIDENCE_LIMIT":
      return "Bạn đã gửi đủ 5 tệp bằng chứng.";
    case "SKILL_PERMISSION_REQUIRED":
      return "Tài khoản hiện chưa được phép bổ sung thông tin.";
    case "REPORT_CASE_CLOSED":
      return "Vụ việc đã kết thúc. Bạn vẫn có thể xem trao đổi và bằng chứng.";
    default:
      return "Chưa thể bổ sung thông tin. Cập nhật trạng thái để tiếp tục.";
  }
}

export function caseAwaitingHandler({
  reason,
  status,
  hasPath,
  handlerId,
  waiting,
}: Readonly<{
  reason?: string | null;
  status?: string;
  hasPath: boolean;
  handlerId?: string | null;
  waiting: boolean;
}>) {
  if (reason === "CASE_HANDLER_REQUIRED") return true;
  const missingHandler = !hasPath && handlerId === null;
  return (missingHandler || waiting) && canWriteCase(status);
}
