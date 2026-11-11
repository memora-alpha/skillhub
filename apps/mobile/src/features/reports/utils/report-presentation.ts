import { appColors as colors } from "@/constants/theme";
import { uiLabel } from "@/constants/ui-copy";
import type { IconName } from "@/components/Icon";
import type { UserReport } from "../api/reports-api";
export const reportStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
  "RESOLVED",
  "REJECTED",
] as const;
export function reportStatusLabel(status: string) {
  return status === "OPEN" ? "Đã tiếp nhận" : uiLabel(status);
}
export function reportStatusTone(status: string) {
  if (status === "NEED_MORE_INFO")
    return { color: colors.warning, backgroundColor: colors.warningLight };
  if (status === "RESOLVED")
    return { color: colors.forest, backgroundColor: colors.forestSoft };
  if (status === "REJECTED")
    return { color: colors.error, backgroundColor: colors.errorLight };
  return { color: colors.info, backgroundColor: colors.infoSoft };
}
export const statusDescriptions: Record<UserReport["status"], string> = {
  OPEN: "Báo cáo của bạn đã được tiếp nhận.",
  UNDER_REVIEW: "Đội ngũ hỗ trợ đang xem xét báo cáo.",
  NEED_MORE_INFO: "Hãy bổ sung thông tin trong phần trao đổi bên dưới.",
  RESOLVED: "Vụ việc đã được giải quyết. Bạn có thể xem kết quả bên dưới.",
  REJECTED: "Báo cáo không được chấp nhận. Xem phản hồi bên dưới nếu có.",
};
export function reportReasonIcon(reason: string): IconName {
  const icons: Record<string, IconName> = {
    NO_SHOW_LATE: "clock",
    TECHNICAL_ISSUE: "settings",
    INAPPROPRIATE_BEHAVIOR: "flag",
    HARASSMENT: "shield",
    SKILL_MISMATCH: "book",
    FALSE_INFORMATION: "alert",
    CREDIT_ISSUE: "wallet",
    INAPPROPRIATE_CONTENT: "file",
    SPAM_SCAM: "shield",
    OTHER: "help",
  };
  return icons[reason] ?? "flag";
}
export function reportDate(date: string | null) {
  return date
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "Chưa ghi nhận thời điểm gửi";
}
export function reportFileLabel(mime: string, bytes: string) {
  const size = Number(bytes),
    type = mime.startsWith("image/") ? "Ảnh" : "Tài liệu";
  if (!Number.isFinite(size) || size <= 0) return type;
  const unit = size >= 1_000_000 ? "MB" : "KB";
  return `${type} · ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(size / (unit === "MB" ? 1_000_000 : 1000))} ${unit}`;
}
