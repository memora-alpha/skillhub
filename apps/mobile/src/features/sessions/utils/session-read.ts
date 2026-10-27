import { AppError, errorMessage } from "@/lib/http/errors";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export function refreshSessionRead(
  client: QueryClient,
  queryKey: QueryKey,
  staleOnly: boolean,
) {
  return client.refetchQueries(
    {
      queryKey,
      exact: true,
      type: "active",
      ...(staleOnly ? { stale: true } : {}),
    },
    { cancelRefetch: false },
  );
}

export class SessionReadGuard {
  denial: "forbidden" | "unavailable" | undefined;
  private sequence = 0;
  async read<T>(load: () => Promise<T>, isCurrent = () => true): Promise<T> {
    const ticket = ++this.sequence;
    try {
      if (!isCurrent()) throw new AppError("session");
      const result = await load();
      if (!isCurrent()) throw new AppError("session");
      if (ticket === this.sequence) this.denial = undefined;
      return result;
    } catch (error) {
      if (
        isCurrent() &&
        ticket === this.sequence &&
        error instanceof AppError
      ) {
        if (error.status === 403) this.denial = "forbidden";
        if (error.status === 404) this.denial = "unavailable";
      }
      throw error;
    }
  }
}
export function sessionReadGuard(client: QueryClient, key: QueryKey) {
  const guard = client.getQueryCache().find({ queryKey: key, exact: true })
    ?.meta?.sessionReadGuard;
  return guard instanceof SessionReadGuard ? guard : new SessionReadGuard();
}
export function sessionReadState(
  data: unknown,
  enabled: boolean,
  error: unknown,
  denial?: string,
) {
  if (!enabled) return "prerequisite";
  if (denial) return "denied";
  if (data !== undefined) return "content";
  return error ? "error" : "loading";
}
const messages: Record<string, string> = {
  LIVEKIT_DISABLED: "Phòng học chưa được máy chủ kích hoạt.",
  LIVEKIT_POLICY_NOT_READY: "Máy chủ chưa cấu hình thời gian mở phòng học.",
  JOIN_WINDOW_NOT_OPEN:
    "Chưa đến thời gian vào phòng học. Hãy tải lại khi đến giờ.",
  JOIN_WINDOW_CLOSED: "Đã hết thời gian vào phòng học.",
  SESSION_NOT_JOINABLE: "Buổi học hiện không cho phép vào phòng.",
  SESSION_ENDED:
    "Buổi học đã kết thúc. Phòng học đã đóng và không thể vào hoặc kết nối lại.",
  SESSION_NOT_ENDED: "Buổi học chưa kết thúc. Hãy xác nhận sau giờ kết thúc.",
  SESSION_ACCESS_DENIED: "Bạn không có quyền truy cập buổi học này.",
  SESSION_BLOCKED_BY_DISPUTE: "Buổi học đang bị chặn bởi tranh chấp.",
  SESSION_CANNOT_BE_COMPLETED: "Buổi học hiện không thể xác nhận hoàn thành.",
  SESSION_CANNOT_BE_RESCHEDULED: "Buổi học hiện không thể đổi lịch.",
  STALE_SCHEDULE_VERSION:
    "Lịch đã thay đổi. Tải lại để xem phiên bản hiện hành.",
  RESCHEDULE_CUTOFF_VIOLATION: "Đã qua hạn đổi lịch; lịch cũ vẫn có hiệu lực.",
  RESCHEDULE_CUTOFF_OR_STATE_VIOLATION:
    "Đề xuất không còn đủ điều kiện; lịch cũ vẫn có hiệu lực.",
  SCHEDULE_CONFLICT:
    "Thời gian đề xuất bị trùng lịch; lịch cũ vẫn có hiệu lực.",
  RESCHEDULE_ALREADY_PENDING:
    "Lịch học đang có đề nghị chờ xác nhận. Hãy xem đề nghị hiện tại trước khi gửi lịch khác.",
  RESCHEDULE_START_NOT_FUTURE: "Chọn thời gian bắt đầu trong tương lai.",
  RESCHEDULE_UNCHANGED: "Chọn ngày giờ hoặc thời lượng khác lịch hiện tại.",
  RESCHEDULE_NOT_CONFIRMABLE:
    "Đề nghị này đã được xác nhận hoặc không còn chờ xác nhận. Hãy kiểm tra lịch hiện tại.",
  SCHEDULE_ALREADY_LOCKED:
    "Lịch đã được chốt. Hãy tải lại để xem giờ học đang có hiệu lực.",
  APPLIED_SCHEDULE_VERSION_MISMATCH:
    "Lịch hiện hành chưa khớp đề nghị. Hãy tải lại trước khi thao tác.",
  SESSION_SCHEDULE_HISTORY_MISSING:
    "Chưa đọc được lịch hiện hành của buổi học. Hãy tải lại trước khi đổi lịch.",
};
export function sessionErrorMessage(error: unknown) {
  return error instanceof AppError && messages[error.code]
    ? messages[error.code]!
    : errorMessage(error);
}
