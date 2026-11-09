import { systemCodeLabel } from "@/lib/system-text";
import type { Tone } from "@/components/console/ui";
import { fmtDateTime } from "../console/format";

const reasons: Record<string, string> = {
  MAKEUP_EXPIRED: "Quá hạn chốt học bù",
  ATTENDANCE_UNVERIFIABLE: "Chưa xác minh được điểm danh",
  NO_SHOW_LATE: "Vắng mặt hoặc đến muộn",
  NO_SHOW: "Không tham gia buổi học",
  INAPPROPRIATE_BEHAVIOR: "Hành vi không phù hợp",
  HARASSMENT: "Quấy rối",
  SKILL_MISMATCH: "Kỹ năng không đúng thỏa thuận",
  FALSE_INFORMATION: "Thông tin sai lệch",
  CREDIT_ISSUE: "Vấn đề Credit",
  SPAM_SCAM: "Spam hoặc lừa đảo",
  OTHER: "Lý do khác",
  LATE_CANCELLATION: "Hủy muộn",
  TECHNICAL_ISSUE: "Sự cố kỹ thuật",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  FRAUD: "Gian lận",
};
export function reportReasonLabel(code: string) {
  return reasons[code] ?? systemCodeLabel(code, "Vấn đề cần xem xét");
}
export function severityTone(code: string | null | undefined): Tone {
  return code === "CRITICAL"
    ? "bad"
    : code === "HIGH"
      ? "warn"
      : code === "MEDIUM"
        ? "info"
        : "neutral";
}
export function targetTypeLabel(type: string) {
  return (
    (
      {
        SESSION: "Buổi học",
        MATERIAL: "Tài liệu",
        USER: "Thành viên",
        TRANSACTION: "Giao dịch",
      } as Record<string, string>
    )[type] ?? "Đối tượng liên quan"
  );
}
export function reportDateLabel(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? fmtDateTime(value)
    : "Chưa có thời gian";
}
