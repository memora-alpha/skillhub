import { AppError, errorMessage } from "@/lib/http/errors";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

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
};
export function sessionErrorMessage(error: unknown) {
  return error instanceof AppError && messages[error.code]
    ? messages[error.code]!
    : errorMessage(error);
}
