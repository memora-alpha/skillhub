import { systemCodeLabel } from "@/lib/system-text";
export const reportReasons = [
  ["TECHNICAL_ISSUE", "Sự cố kỹ thuật"],
  ["INAPPROPRIATE_BEHAVIOR", "Hành vi không phù hợp"],
  ["HARASSMENT", "Quấy rối"],
  ["SKILL_MISMATCH", "Kỹ năng không phù hợp"],
  ["FALSE_INFORMATION", "Thông tin sai lệch"],
  ["CREDIT_ISSUE", "Vấn đề Credit"],
  ["INAPPROPRIATE_CONTENT", "Nội dung không phù hợp"],
  ["SPAM_SCAM", "Spam / lừa đảo"],
  ["OTHER", "Khác"],
] as const;

export const canSubmitReportReason = (code: string) =>
  reportReasons.some(([reason]) => reason === code);

export function reportReasonLabel(code: string) {
  if (code === "NO_SHOW_LATE") return "Vắng học / đến muộn (báo cáo trước đây)";
  return (
    reportReasons.find(([reason]) => reason === code)?.[1] ??
    systemCodeLabel(code, "Vấn đề cần xem xét")
  );
}
