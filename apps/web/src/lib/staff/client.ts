import { knownSystemMessage } from "@/lib/system-text";
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
  INVALID_REPORT_QUEUE_FILTER:
    "Bộ lọc báo cáo không hợp lệ. Xóa bộ lọc rồi thử lại.",
  USER_MAKEUP_LIMIT_REACHED:
    "Người tham gia đã hết lượt học bù trong thỏa thuận này. Chọn phương án xử lý khác theo bằng chứng; không thể cấp thêm lượt.",
  SESSION_MAKEUP_LIMIT_REACHED:
    "Buổi học đã sử dụng lượt học bù. Chỉ có thể gia hạn lượt đã cấp khi còn hợp lệ hoặc chọn phương án xử lý khác.",
  MAKEUP_ATTRIBUTION_REVIEW_REQUIRED:
    "Lịch sử học bù chưa xác định được người sử dụng lượt. Cần kiểm tra lịch sử trước khi cấp học bù.",
  MAKEUP_USER_REQUIRED: "Chọn người tham gia sử dụng lượt học bù.",
  MAKEUP_USER_NOT_PARTICIPANT:
    "Người dùng lượt học bù phải là người tham gia buổi học.",
  NO_SHOW_RULING_NOT_APPLICABLE:
    "Phán quyết này không áp dụng cho trạng thái điểm danh hiện tại. Tải lại báo cáo và chọn phương án phù hợp.",
  CANCELLATION_MAKEUP_RULING_NOT_APPLICABLE:
    "Buổi học không có lượt học bù từ yêu cầu hủy còn hiệu lực để xử lý. Tải lại báo cáo và kiểm tra lịch sử buổi học.",
  MAKEUP_USER_REQUIRES_EXCUSE_RULING:
    "Chỉ chọn người sử dụng lượt học bù khi chấp nhận lý do và yêu cầu học bù.",
  ONE_SESSION_RULING_REQUIRED:
    "Chỉ chọn một phán quyết cho buổi học: xử lý điểm danh hoặc xử lý lượt học bù từ hủy buổi.",
  NO_SHOW_REQUIRES_ATTENDANCE_RULING:
    "Dùng phán quyết điểm danh để xử lý vắng học; không ghi thêm vi phạm vắng học cho cùng buổi.",
  RESOLUTION_PERMISSION_REQUIRED:
    "Bạn chưa có quyền áp dụng biện pháp Credit hoặc hạn chế này. Bỏ biện pháp bổ sung hoặc nhờ quản trị viên có quyền xử lý.",
  REPORT_CASE_NOT_ASSIGNED_TO_CALLER:
    "Báo cáo đang do người khác phụ trách. Tải lại để kiểm tra người xử lý trước khi ra quyết định.",
  NO_SHOW_RULING_REQUIRED:
    "Buổi học đang tranh chấp cần một phán quyết điểm danh trước khi kết thúc báo cáo.",
  REPORT_CASE_NOT_CLAIMABLE:
    "Báo cáo đã được nhận hoặc đã kết thúc. Làm mới hàng đợi để xem trạng thái hiện tại.",
  REPORT_CASE_NOT_FOUND:
    "Báo cáo không còn tồn tại hoặc bạn không thể truy cập. Hãy quay lại hàng đợi.",
  REPORT_CASE_CLOSED:
    "Báo cáo đã kết thúc. Bạn chỉ có thể xem lại nội dung và lịch sử.",
  STALE_REPORT_CASE_VERSION:
    "Mức độ hoặc trạng thái báo cáo đã thay đổi. Tải lại báo cáo trước khi lưu.",
  STALE_INCIDENT_VERSION:
    "Vụ việc chung đã thay đổi. Tải lại để xem quyết định mới nhất.",
  CLASSIFY_INCIDENT_REQUIRED:
    "Báo cáo đã thuộc vụ việc chung. Đổi mức độ trong phần xử lý vụ việc chung.",
  INCIDENT_NOT_ASSIGNED:
    "Bạn không phải người phụ trách vụ việc chung này. Làm mới để kiểm tra người xử lý.",
  CASE_MESSAGE_CONTENT_UNAVAILABLE:
    "Chưa tải được nội dung trao đổi. Tin nhắn của bạn vẫn được giữ; hãy thử tải lại.",
  CASE_PARTY_REQUIRED:
    "Người được chọn không phải bên liên quan của vụ việc. Kiểm tra lại người trao đổi.",
  CASE_THREAD_CLOSED:
    "Vụ việc đã kết thúc nên không thể gửi tin nhắn mới. Bạn vẫn có thể xem lịch sử.",
  MATERIAL_FILE_REQUIRED:
    "Tài liệu chưa có tệp sẵn sàng, chưa được xác nhận an toàn hoặc chưa xác nhận quyền phân phối. Kiểm tra lại trước khi công bố.",
  MATERIAL_REASON_REQUIRED: "Nhập lý do xử lý tài liệu trước khi xác nhận.",
  FILE_NOT_READY:
    "Tệp vẫn đang được kiểm tra hoặc chưa sẵn sàng. Vui lòng thử lại sau.",
  FILE_NOT_FOUND:
    "Tệp không còn khả dụng hoặc bạn không có quyền xem. Làm mới nội dung để kiểm tra.",
  FILE_OBJECT_MISMATCH:
    "Nội dung tệp chưa thể tải đầy đủ. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
  STALE_TERMINATION_EXECUTION:
    "Kết quả học hoặc khoản Credit đang giữ đã thay đổi. Tải lại và kiểm tra phương án trước khi xác nhận.",
  TERMINATION_ALREADY_APPROVED:
    "Yêu cầu đã được chấp thuận dừng nên không thể từ chối. Tải lại để xem tiến độ phân bổ Credit.",
  TERMINATION_DECISION_CONFLICT:
    "Yêu cầu đã có một quyết định khác. Tải lại để đối chiếu kết quả trước khi tiếp tục.",
  TERMINATION_FORMULA_MISMATCH:
    "Phương án Credit không còn khớp với dữ liệu mới nhất. Tải lại phương án trước khi xác nhận.",
  TERMINATION_POLICY_NOT_APPROVED:
    "Chính sách dừng lộ trình chưa được duyệt hoặc vừa thay đổi. Kiểm tra lại chi tiết yêu cầu.",
  TERMINATION_ALLOCATION_MISMATCH:
    "Khoản Credit đang giữ chưa đủ điều kiện phân bổ. Tải lại chi tiết và kiểm tra các khoản giữ.",
  TERMINATION_SESSION_RULING_REQUIRED:
    "Một số buổi học còn chờ kết luận. Cần xử lý các buổi đó trước khi phân bổ Credit.",
  TERMINATION_USE_FINAL_SETTLEMENT:
    "Các buổi học đã hoàn tất. Hãy dùng luồng quyết toán lộ trình để xử lý Credit.",
  TERMINATION_REVIEW_PERMISSION_REQUIRED:
    "Bạn chưa có quyền xem xét hoặc thực thi dừng lộ trình. Liên hệ quản trị viên để kiểm tra quyền.",
  INDEPENDENT_REVIEWER_REQUIRED:
    "Bạn là người tham gia lộ trình này. Cần một quản trị viên độc lập xử lý yêu cầu.",
  CREDIT_TRANSACTION_NOT_FOUND:
    "Không tìm thấy giao dịch hoặc giao dịch không còn trong phạm vi truy cập của bạn.",
  CREDIT_OPERATION_NOT_FOUND:
    "Không tìm thấy nghiệp vụ liên quan. Hãy làm mới danh sách giao dịch để kiểm tra.",
  ADMIN_FINANCE_PERMISSION_REQUIRED:
    "Bạn chưa có quyền tra cứu giao dịch Credit. Liên hệ quản trị viên để kiểm tra quyền.",
  INVALID_ADMIN_FINANCE_CURSOR:
    "Danh sách giao dịch đã thay đổi hoặc bộ lọc không còn khớp. Làm mới để tải lại từ đầu.",
  INVALID_REPORT_QUEUE_CURSOR:
    "Danh sách báo cáo hoặc bộ lọc đã thay đổi. Bấm Làm mới để tải lại từ trang đầu.",
  INCIDENT_DECISION_REQUIRED:
    "Báo cáo đã được gom. Mở vụ việc chung để ra quyết định.",
  REPORT_SELF_MODERATION_FORBIDDEN:
    "Vụ việc có liên quan đến bạn. Cần một nhân viên khác xử lý.",
  PROFILE_SELF_MODERATION_FORBIDDEN:
    "Hồ sơ của bạn cần một nhân viên khác kiểm duyệt.",
  REVIEW_SELF_MODERATION_FORBIDDEN:
    "Đánh giá liên quan đến bạn cần một nhân viên khác kiểm duyệt.",
  CASE_HANDLER_REQUIRED: "Nhận xử lý báo cáo trước khi trao đổi.",
  CASE_THREAD_ACCESS_DENIED: "Bạn chưa được giao xử lý cuộc trao đổi này.",
  REPORT_INCIDENT_TARGET_MISMATCH:
    "Chỉ gom các báo cáo có cùng đối tượng và buổi học.",
  REPORT_CASE_NOT_GROUPABLE:
    "Một báo cáo đã được xử lý, đã gom hoặc được giao cho người khác. Tải lại hàng đợi.",
  STALE_STAFF_PERMISSION_VERSION:
    "Quyền nhân viên đã thay đổi. Làm mới quyền rồi xác nhận lại.",
  STALE_FEE_POLICY_VERSION:
    "Phiên bản phí đã thay đổi. Tải lại và chọn phiên bản tiếp theo.",
  FEE_POLICY_EFFECTIVE_TIME_IN_PAST:
    "Thời điểm áp dụng phải ở tương lai hoặc để trống để áp dụng ngay.",
  API_UPSTREAM_CHALLENGE:
    "Kết nối tới máy chủ đang bị chặn. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
  SESSION_RETRY_REQUIRED:
    "Đã làm mới phiên. Kiểm tra trạng thái rồi thực hiện lại thao tác.",
  DEMO_RESOLUTION_UNSUPPORTED:
    "Dữ liệu thử chỉ hỗ trợ ghi chú và trạng thái báo cáo; chưa áp dụng thay đổi Credit hoặc uy tín.",
  DEMO_DATA_INVALID:
    "Dữ liệu thử bị lỗi. Chọn Đặt lại dữ liệu thử rồi bật lại để tiếp tục.",
  DEMO_STORAGE_UNAVAILABLE:
    "Trình duyệt chưa cho phép lưu dữ liệu thử. Kiểm tra quyền lưu trữ rồi thử lại.",
  DEMO_ROUTE_UNAVAILABLE:
    "Thao tác này chưa có trong dữ liệu thử. Chuyển sang dữ liệu thật để sử dụng.",
  MATERIAL_SELF_REVIEW_FORBIDDEN:
    "Tài liệu của bạn cần một nhân viên khác duyệt hoặc hiện lại.",
  MATERIAL_VERSION_CONFLICT:
    "Tài liệu đã thay đổi. Tải lại để xem phiên bản mới nhất trước khi xử lý.",
  MATERIAL_TRANSITION_INVALID:
    "Trạng thái tài liệu đã thay đổi. Tải lại rồi chọn thao tác phù hợp.",
  MATERIAL_PERMISSION_REQUIRED:
    "Bạn chưa được cấp quyền xử lý tài liệu. Liên hệ quản trị viên để kiểm tra quyền.",
  STAFF_ACCESS_REQUIRED:
    "Bạn chưa được cấp quyền duyệt tài liệu. Liên hệ quản trị viên để kiểm tra quyền.",
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
  TITLE_NOT_UNLOCKED:
    "Danh hiệu này chưa được mở khóa hoặc không còn khả dụng. Hãy làm mới thành tích.",
  FILE_TYPE_NOT_SUPPORTED: "Định dạng tệp này chưa được hỗ trợ.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  EMAIL_ALREADY_EXISTS:
    "Email này đã được sử dụng. Chọn email khác hoặc quản lý tài khoản hiện có.",
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
  const translated = knownSystemMessage(code);
  if (translated) return translated;
  if (code === "FILE_UNAVAILABLE" || code === "INVALID_DOWNLOAD_LINK")
    return "Không thể mở tệp hoặc liên kết đã hết hạn. Nhấn Thử lại để lấy liên kết mới.";
  if (code === "API_RESPONSE_INVALID")
    return "Chưa đọc được đầy đủ dữ liệu trả về. Vui lòng tải lại trước khi thực hiện thao tác.";
  if (code === "API_UNAVAILABLE")
    return "Chưa kết nối được với máy chủ. Vui lòng thử lại sau ít giây.";
  if (status === 401) return "Phiên đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 409)
    return "Dữ liệu đã thay đổi hoặc thao tác không còn hợp lệ. Tải lại trước khi xử lý.";
  if (status === 404)
    return "Không tìm thấy mục này hoặc mục không còn trong hàng đợi.";
  if (status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.";
  if (status === 408)
    return "Đã quá thời gian chờ nên chưa xác nhận được kết quả. Tải lại dữ liệu để kiểm tra trước khi gửi lại.";
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
  const work = async () => {
    // Another portal/tab may have renewed the shared cookie while this one waited.
    try {
      await staffApi("session", {}, portal, false);
      return;
    } catch (cause) {
      if (!(cause instanceof StaffApiError) || cause.status !== 401)
        throw cause;
    }
    await staffApi(
      "session/refresh",
      { method: "POST", body: {} },
      portal,
      false,
    );
  };
  renewals[portal] ??= (
    typeof navigator !== "undefined" && "locks" in navigator
      ? navigator.locks.request("skillhub-session", work)
      : work()
  ).finally(() => {
    delete renewals[portal];
  });
  return renewals[portal];
}
function canRenewSession(
  path: string,
  options: ApiOptions,
  retry: boolean,
  status: number,
  message?: string,
) {
  const canReadSession = !options.method || options.method === "GET";
  const canRefreshPath =
    path === "session" ? canReadSession : !path.startsWith("session/");
  return (
    retry &&
    status === 401 &&
    ["SESSION_EXPIRED", "SESSION_UNAVAILABLE"].includes(message ?? "") &&
    canRefreshPath
  );
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
    if (
      options.signal?.aborted ||
      (e instanceof Error && e.name === "AbortError")
    )
      throw e;
    throw new StaffApiError(0, "NETWORK_ERROR");
  }
  if (response.ok) return response;
  let envelope: { message?: string };
  try {
    envelope = await response.json();
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new StaffApiError(502, "API_RESPONSE_INVALID");
  }
  if (
    canRenewSession(path, options, retry, response.status, envelope?.message)
  ) {
    await refreshStaffSession(portal);
    if ((options.method ?? "GET").toUpperCase() !== "GET")
      throw new StaffApiError(409, "SESSION_RETRY_REQUIRED");
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
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
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
