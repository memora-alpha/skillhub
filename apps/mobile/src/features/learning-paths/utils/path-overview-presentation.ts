import type {
  PathOverviewCard,
  PathAttention,
} from "../api/path-overview-contract";
import type { PathTarget } from "../api/path-target-contract";
import { uuid } from "@/lib/http/contracts";

export const learningStageLabels: Record<
  NonNullable<PathOverviewCard["learningStage"]>,
  string
> = {
  PREPARING: "Đang chuẩn bị thỏa thuận",
  WAITING_START: "Chờ bắt đầu học",
  LEARNING: "Đang học",
  LEARNING_FINISHED: "Đã học xong · Chờ quyết toán",
  COMPLETED: "Đã hoàn thành và quyết toán",
  STOPPED: "Đã dừng học",
};
export function learningStageLabel(stage: PathOverviewCard["learningStage"]) {
  return stage ? learningStageLabels[stage] : undefined;
}
export function pathTargetHref(
  pathId: string,
  target: PathTarget,
  sessionId?: string | null,
) {
  if (!uuid.safeParse(pathId).success || !uuid.safeParse(target.id).success)
    return;
  if (target.type === "CASE_SUMMARY")
    return `/paths/${pathId}/cases/${target.id}` as const;
  if (target.type === "SESSION")
    return `/learning-sessions/${target.id}` as const;
  if (target.type === "LEARNING_CHANGE") {
    if (sessionId && uuid.safeParse(sessionId).success)
      return `/learning-sessions/${sessionId}` as const;
    return `/paths/${pathId}/cancel?changeRequestId=${target.id}` as const;
  }
  if (target.type === "LEARNING_PATH" && target.id === pathId)
    return `/paths/${pathId}` as const;
}
export const waitingOnLabels: Record<string, string> = {
  SELF: "Bạn cần xử lý",
  COUNTERPART: "Chờ đối tác",
  STAFF: "Chờ nhân sự xử lý",
  SYSTEM: "Chờ hệ thống xử lý",
  UNKNOWN: "Đang xác minh bên cần xử lý",
};
const reasons: Record<string, string> = {
  PATH_TERMINATION: "Yêu cầu dừng thỏa thuận",
  SESSION_CANCELLATION: "Yêu cầu hủy buổi để học bù",
  SESSION_AWAITING_CONFIRMATION: "Buổi học chờ xác nhận",
  SESSION_MAKEUP_REQUIRED: "Buổi học cần học bù",
  SESSION_NO_SHOW: "Buổi học có người vắng",
  SESSION_DISPUTED: "Buổi học đang tranh chấp",
  SESSION_CONFIRMED: "Chờ cập nhật kết quả buổi học",
  SESSION_READY: "Chờ cập nhật kết quả buổi học",
  SESSION_ONGOING: "Chờ cập nhật kết quả buổi học",
  NO_SHOW_LATE: "Vắng mặt hoặc trễ nghiêm trọng",
  MAKEUP_LIMIT_REACHED: "Đã hết lượt học bù",
  ATTENDANCE_UNVERIFIABLE: "Cần xác minh việc tham gia buổi học",
  INAPPROPRIATE_BEHAVIOR: "Hành vi không phù hợp",
  HARASSMENT: "Quấy rối hoặc xúc phạm",
  SKILL_MISMATCH: "Nội dung học khác thỏa thuận",
  TECHNICAL_ISSUE: "Sự cố kỹ thuật",
  CREDIT_ISSUE: "Vấn đề Credit",
  OTHER: "Vấn đề khác",
};
export function pathReasonLabel(reason: string) {
  return reasons[reason] ?? "Vấn đề cần xem xét";
}
export function attentionTitle(item: PathAttention) {
  return (
    reasons[item.reasonCode] ??
    (item.type === "REPORT_CASE"
      ? "Vụ việc liên quan lộ trình"
      : "Việc cần xử lý")
  );
}
export function pathDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
