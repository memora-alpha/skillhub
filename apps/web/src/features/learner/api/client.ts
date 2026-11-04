import type { Reply } from "../types";
export class UserApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(userErrorText(status, code));
  }
}
const messages: Record<string, string> = {
  DISPUTE_WINDOW_OPEN:
    "Chưa hết thời hạn khiếu nại. Hãy kiểm tra quyết toán sau thời hạn này.",
  PATH_SESSIONS_INCOMPLETE:
    "Cần hoàn thành tất cả buổi học trước khi quyết toán.",
  SETTLEMENT_BLOCKED_BY_DISPUTE:
    "Lộ trình đang có tranh chấp cần xử lý trước khi quyết toán.",
  LEARNING_PATH_NOT_SETTLEABLE:
    "Lộ trình hiện chưa đủ điều kiện quyết toán. Tải lại trạng thái để kiểm tra.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
  USER_PORTAL_ACCESS_REQUIRED:
    "Dùng tài khoản người dùng để vào khu học tập. Admin/Staff có cổng riêng.",
  SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn.",
  SESSION_RETRY_REQUIRED:
    "Đã làm mới phiên. Kiểm tra trạng thái rồi thực hiện lại thao tác.",
  LOGOUT_BEFORE_LOGIN: "Cần đăng xuất phiên cũ trước khi đổi tài khoản.",
  API_UNAVAILABLE: "Chưa kết nối được máy chủ. Hãy thử lại.",
  SCHEDULE_CONFLICT:
    "Lịch bị trùng với buổi khác. Chọn một khoảng thời gian khác.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Một tài khoản chưa đủ Credit khả dụng để chốt lịch.",
  LIVEKIT_POLICY_NOT_READY:
    "Máy chủ chưa cấu hình thời gian mở phòng học. Cần phía BE bật livekit.joinWindow.",
  LIVEKIT_DISABLED: "Máy chủ chưa bật phòng học.",
  JOIN_WINDOW_NOT_OPEN: "Chưa đến giờ mở phòng.",
  JOIN_WINDOW_CLOSED: "Đã hết giờ vào phòng.",
  SESSION_ATTENDANCE_NOT_MET: "Điểm danh chưa đủ điều kiện xác nhận hoàn tất.",
  ATTENDANCE_PENDING: "Hệ thống đang tổng hợp điểm danh. Hãy tải lại sau.",
  CONFIRM_WINDOW_CLOSED: "Đã hết thời hạn xác nhận hoàn tất.",
  TEACHER_SKILL_NOT_ELIGIBLE:
    "Bạn cần khai báo kỹ năng phù hợp trước khi gửi đề xuất.",
  PROPOSAL_ALREADY_PENDING: "Bạn đã gửi đề xuất cho bài này. Xem mục Kết nối.",
  REQUEST_NOT_AVAILABLE: "Bài học không còn nhận đề xuất.",
  STALE_SCHEDULE_VERSION:
    "Lịch đã thay đổi. Tải lại và xác nhận phiên bản mới.",
  REQUEST_VERSION_CONFLICT: "Bài viết đã đổi. Tải lại trước khi thao tác.",
  COMMAND_UNCERTAIN:
    "Chưa xác định kết quả lần gửi trước. Hãy kiểm tra trạng thái trước khi gửi yêu cầu khác.",
};
export function userErrorText(status: number, code: string) {
  if (messages[code]) return messages[code];
  switch (status) {
    case 429:
      return "Bạn đang thao tác nhanh. Chờ một lát rồi thử lại.";
    case 409:
      return "Trạng thái đã thay đổi. Tải lại trước khi tiếp tục.";
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy nội dung hoặc bạn không có quyền truy cập.";
    case 400:
      return "Thông tin chưa hợp lệ. Kiểm tra lại các trường.";
    default:
      return status >= 500
        ? "Máy chủ đang gặp lỗi. Hãy thử lại sau."
        : "Không thể hoàn tất. Vui lòng thử lại.";
  }
}
export type UserRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  key?: string;
  signal?: AbortSignal;
};
function requestInit(options: UserRequestOptions): RequestInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (typeof FormData !== "undefined" && options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }
  if (options.key) headers["Idempotency-Key"] = options.key;
  return {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
    headers,
    body,
  };
}
function responseCode(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string" &&
    /^[A-Z_]+$/.test(value.message)
  )
    return value.message;
  return "";
}
function successReply<T>(value: unknown): Reply<T> {
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !("success" in value) ||
    value.success !== true
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return value as Reply<T>;
}
export async function userFetch<T>(
  path: string,
  options: UserRequestOptions = {},
): Promise<Reply<T>> {
  let response: Response;
  try {
    response = await fetch("/api/user/" + path, requestInit(options));
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new UserApiError(0, "API_UNAVAILABLE");
  }
  if (response.status === 204) return { success: true, data: undefined as T };
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  }
  if (!response.ok)
    throw new UserApiError(response.status, responseCode(value));
  return successReply<T>(value);
}
