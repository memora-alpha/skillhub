import type { ApiEnvelope } from "./types";
import type { Portal } from "./policy";
import { allowedEvidenceMime, allowedMaterialMime } from "./evidence-file";
export class StaffApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(messageFor(status, code));
  }
}
export function isSessionFailure(error: unknown): boolean {
  return (
    error instanceof StaffApiError &&
    ((error.status === 401 &&
      !["INVALID_CREDENTIALS", "REAUTH_REQUIRED"].includes(error.code)) ||
      error.code === "STAFF_PORTAL_ACCESS_REQUIRED" ||
      error.code === "ADMIN_PORTAL_ACCESS_REQUIRED")
  );
}
const errorMessages: Readonly<Record<string, string>> = {
  MATERIAL_SELF_REVIEW_FORBIDDEN:
    "Tài liệu của bạn cần một nhân viên khác duyệt hoặc hiện lại.",
  MATERIAL_VERSION_CONFLICT:
    "Tài liệu đã thay đổi. Tải lại để xem phiên bản mới nhất trước khi xử lý.",
  MATERIAL_TRANSITION_INVALID:
    "Trạng thái tài liệu đã thay đổi. Tải lại rồi chọn thao tác phù hợp.",
  MATERIAL_PERMISSION_REQUIRED:
    "Tài khoản chưa được cấp quyền thao tác với tài liệu. Cần người quản lý server đồng bộ quyền.",
  STAFF_ACCESS_REQUIRED:
    "Tài khoản chưa được cấp quyền duyệt tài liệu. Cần người quản lý server đồng bộ quyền.",
  SKILL_LEVEL_DUPLICATE: "Mã hoặc tên cấp độ đã tồn tại trong kỹ năng này.",
  TAG_ALREADY_EXISTS:
    "Tên tag đã tồn tại. Chọn tên khác hoặc kiểm tra lại danh mục tag.",
  TAG_REQUEST_NOT_PENDING:
    "Đề xuất tag đã được xử lý. Tải lại để xem quyết định mới nhất.",
  TAG_UNAVAILABLE:
    "Tag đang tạm ngưng hoặc đã được lưu trữ. Kiểm tra lại danh mục tag.",
  TAG_ARCHIVED:
    "Tag đang tạm ngưng hoặc đã được lưu trữ. Kiểm tra lại danh mục tag.",
  REVERSAL_OPERATION_NOT_IN_PATH:
    "Giao dịch cần đảo không thuộc lộ trình của vụ việc này.",
  RESOLUTION_PERMISSION_REQUIRED:
    "Bạn chưa có quyền áp dụng một hoặc nhiều biện pháp xử lý đã chọn.",
  REPORT_CASE_NOT_ASSIGNED_TO_CALLER:
    "Vụ việc chưa được giao cho bạn. Tải lại để kiểm tra người phụ trách.",
  TITLE_NOT_UNLOCKED:
    "Danh hiệu này chưa được mở khóa hoặc không còn khả dụng. Hãy làm mới thành tích.",
  FILE_TYPE_NOT_SUPPORTED: "Định dạng tệp này chưa được hỗ trợ.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  ADMIN_PORTAL_ACCESS_REQUIRED:
    "Cổng Admin chỉ dành cho tài khoản có quyền ADMIN.",
  REAUTH_REQUIRED:
    "Xác thực lại đã hết hạn hoặc đã được sử dụng. Vui lòng nhập lại mật khẩu Admin.",
  ADMIN_ROLE_CANNOT_BE_REPLACED_BY_STAFF:
    "Không thể chuyển tài khoản Admin sang Staff.",
  LOGOUT_BEFORE_LOGIN:
    "Phiên trước cần được đăng xuất. Chọn Kết thúc phiên cũ rồi đăng nhập lại.",
  STAFF_PORTAL_ACCESS_REQUIRED:
    "Tài khoản này chưa được phân quyền Staff hoặc Admin.",
};
function messageFor(status: number, code: string) {
  if (Object.hasOwn(errorMessages, code)) return errorMessages[code];
  if (code === "FILE_UNAVAILABLE" || code === "INVALID_DOWNLOAD_LINK")
    return "Không thể mở tệp hoặc liên kết đã hết hạn. Nhấn Thử lại để lấy liên kết mới.";
  if (code === "API_UNAVAILABLE" || code === "API_RESPONSE_INVALID")
    return "Không thể kết nối backend. Kiểm tra dịch vụ API rồi thử lại.";
  if (status === 401) return "Phiên đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 409)
    return "Dữ liệu đã thay đổi hoặc thao tác không còn hợp lệ. Tải lại trước khi xử lý.";
  if (status === 404)
    return "Không tìm thấy mục này hoặc mục không còn trong hàng đợi.";
  if (status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.";
  if (status >= 500 || status === 0)
    return "Chưa nhận được kết quả từ máy chủ. Tải lại dữ liệu để kiểm tra trước khi tiếp tục.";
  return "Thông tin chưa hợp lệ. Kiểm tra nội dung và thử lại.";
}
export type ApiOptions = {
  method?: string;
  body?: Record<string, unknown>;
  key?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};
export type PortalApi = <T>(
  path: string,
  options?: ApiOptions,
) => Promise<ApiEnvelope<T>>;
const renewals: Partial<Record<Portal, Promise<void>>> = {};
export function refreshStaffSession(portal: Portal) {
  renewals[portal] ??= staffApi(
    "session/refresh",
    { method: "POST", body: {} },
    portal,
    false,
  )
    .then(() => undefined)
    .finally(() => {
      delete renewals[portal];
    });
  return renewals[portal];
}
async function portalResponse(
  path: string,
  options: ApiOptions = {},
  portal: Portal = "staff",
  retry = true,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/${portal}/${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
      headers: {
        ...options.headers,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new StaffApiError(0, "NETWORK_ERROR");
  }
  if (response.ok) return response;
  let envelope: { message?: string };
  try {
    envelope = await response.json();
  } catch {
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  }
  if (
    retry &&
    response.status === 401 &&
    ["SESSION_EXPIRED", "SESSION_UNAVAILABLE"].includes(
      envelope?.message ?? "",
    ) &&
    (path === "session"
      ? !options.method || options.method === "GET"
      : !path.startsWith("session/"))
  ) {
    await refreshStaffSession(portal);
    return portalResponse(path, options, portal, false);
  }
  throw new StaffApiError(
    response.status,
    typeof envelope?.message === "string" ? envelope.message : "REQUEST_FAILED",
  );
}
export async function staffApi<T>(
  path: string,
  options: ApiOptions = {},
  portal: Portal = "staff",
  retry = true,
): Promise<ApiEnvelope<T>> {
  const response = await portalResponse(path, options, portal, retry);
  if (response.status === 204) return { success: true, data: null as T };
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json();
  } catch {
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  }
  if (envelope?.success !== true)
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  if (!("data" in envelope))
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  return envelope;
}
export async function staffFile(
  path: string,
  portal: Portal,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await portalResponse(path, { signal }, portal);
  const allowedMime = path.startsWith("materials/")
    ? allowedMaterialMime
    : allowedEvidenceMime;
  if (!allowedMime(response.headers.get("content-type") ?? ""))
    throw new StaffApiError(502, "FILE_TYPE_NOT_SUPPORTED");
  return response.blob();
}

export async function staffEvents(
  portal: Portal,
  signal: AbortSignal,
  cursor?: string,
) {
  const response = await portalResponse(
    "events",
    {
      signal,
      headers: {
        Accept: "text/event-stream",
        ...(cursor ? { "Last-Event-ID": cursor } : {}),
      },
    },
    portal,
  );
  if (
    !response.headers.get("content-type")?.includes("text/event-stream") ||
    !response.body
  ) {
    await response.body?.cancel();
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  }
  return response.body;
}
