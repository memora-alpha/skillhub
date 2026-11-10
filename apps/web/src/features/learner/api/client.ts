import { knownSystemMessage } from "@/lib/system-text";
import {
  findContactInformation,
  contactInformationNotice,
} from "@/lib/contact-policy";
import type { Reply } from "../types";
export class UserApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(userErrorText(status, code));
  }
}
const messages: Record<string, string> = {
  CONTACT_INFORMATION_BLOCKED: contactInformationNotice,
  MATERIAL_REFUND_WINDOW_CLOSED: "Đã quá hạn hoàn đơn 24 giờ.",
  MATERIAL_ALREADY_CONSUMED:
    "Đơn đã lấy liên kết tải nên không thể hoàn tự động.",
  MATERIAL_REFUND_ADMIN_REQUIRED:
    "Số dư bên bán chưa đủ để hoàn tự động. Cần nhân sự hỗ trợ xử lý.",
  MATERIAL_ORDER_NOT_FOUND:
    "Không tìm thấy đơn tài liệu. Làm mới danh sách để kiểm tra.",
  MATERIAL_ORDER_NOT_REFUNDABLE:
    "Trạng thái đơn hiện tại không cho phép hoàn. Làm mới để xem kết quả mới nhất.",
  MATERIAL_ENTITLEMENT_NOT_ACTIVE:
    "Quyền tải của đơn không còn hoạt động. Cần kiểm tra với bộ phận hỗ trợ.",
  MATERIAL_NOT_EDITABLE:
    "Tài liệu bị ẩn hoặc đã lưu trữ không cho phép chỉnh sửa.",
  SESSION_MAKEUP_LIMIT_REACHED:
    "Buổi này đã dùng lượt học bù. Cần nhân sự xem xét nếu vẫn còn vấn đề.",
  USER_MAKEUP_LIMIT_REACHED:
    "Người yêu cầu đã hết lượt học bù trong thỏa thuận. Không thể tự cấp thêm lượt.",
  MAKEUP_ATTRIBUTION_REVIEW_REQUIRED:
    "Lịch sử học bù cần nhân sự xác minh người sử dụng lượt.",
  SESSION_RESCHEDULE_LIMIT_REACHED: "Buổi này đã đổi lịch đủ 3 lần.",
  RESCHEDULE_SESSION_ORDER_VIOLATION:
    "Giờ mới phải giữ đúng thứ tự các buổi trong kế hoạch.",
  LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED:
    "Buổi cuối chỉ được dời tối đa 48 giờ so với lịch gốc.",
  RESCHEDULE_CUTOFF_VIOLATION:
    "Đã quá hạn đổi lịch: cả hai phải chốt ít nhất 60 phút trước giờ học cũ.",
  SESSION_CANNOT_BE_CANCELLED:
    "Buổi đã bắt đầu hoặc không còn đủ điều kiện hủy để học bù.",
  CHANGE_REQUEST_ALREADY_PENDING:
    "Đã có yêu cầu đang chờ xử lý. Tải lại lịch sử yêu cầu.",
  CHANGE_REQUEST_EXPIRED: "Yêu cầu đã hết hạn; lịch hiện tại vẫn theo máy chủ.",
  STALE_SESSION_OCCURRENCE:
    "Giờ buổi học đã thay đổi. Tải lại trước khi gửi yêu cầu.",
  STALE_CHANGE_REQUEST_VERSION:
    "Yêu cầu đã được cập nhật. Tải lại để xem phản hồi mới.",
  SETTLEMENT_STATE_CHANGED:
    "Điều kiện hoặc phiên bản quyết toán đã đổi. Tải lại và xem trước khi đồng ý.",
  SETTLEMENT_BLOCKED_BY_TERMINATION:
    "Đang xử lý yêu cầu dừng lộ trình nên chưa thể quyết toán.",
  TERMINATION_POLICY_NOT_APPROVED:
    "Chờ chính sách phân bổ Credit được duyệt; chưa thể thực thi dừng lộ trình.",
  REVIEW_NOT_OPEN:
    "Đánh giá chỉ mở sau khi toàn bộ lộ trình hoàn thành và đã quyết toán.",
  REVIEW_ALREADY_SUBMITTED: "Bạn đã gửi đánh giá cho lộ trình này.",
  ACTIVE_SESSION_REPORT_EXISTS:
    "Bạn đã có báo cáo đang xử lý cho buổi này. Mở Báo cáo của tôi để theo dõi.",
  DISPUTE_WINDOW_CLOSED: "Đã hết thời hạn gửi báo cáo cho buổi học này.",
  SESSION_NOT_REPORTABLE: "Buổi đã hủy không nhận báo cáo buổi học mới.",
  API_UPSTREAM_CHALLENGE:
    "Kết nối tới máy chủ đang bị chặn. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
  TAG_UNAVAILABLE:
    "Tag này đã tồn tại nhưng hiện không dùng được. Chọn tag khác hoặc chờ Admin xử lý; không đề xuất bản trùng.",
  NEW_ACTIVITY_RESTRICTED:
    "Tài khoản đang bị hạn chế tạo hoạt động mới. Bạn vẫn có thể kiểm tra lịch sử và các hoạt động đã có quyền truy cập.",
  SESSION_NOT_JOINABLE:
    "Buổi học hoặc thỏa thuận hiện chưa cho vào phòng. Kiểm tra lại trạng thái buổi học.",
  SESSION_ACCESS_DENIED:
    "Bạn không còn quyền vào phòng của buổi học này. Quay lại chi tiết buổi học để kiểm tra.",
  INVALID_PAYMENT_AMOUNT:
    "Số tiền cần từ 1.000 đến 2.000.000 VND và là bội số của 1.000.",
  STALE_COMMITMENT_SNAPSHOT:
    "Điều khoản, kế hoạch hoặc lịch đã đổi. Kiểm tra thỏa thuận, buổi học hiện tại và đối chiếu phiên bản mới trước khi chốt.",
  INVALID_TAG_LABEL:
    "Tên tag cần từ 1 đến 80 ký tự, không chứa ký tự điều khiển.",
  TAG_ALREADY_EXISTS:
    "Tag này đã có trong danh mục. Hãy tìm và chọn tag có sẵn còn hiệu lực.",
  TAG_REQUEST_ALREADY_PENDING:
    "Bạn đã có đề xuất tag này đang chờ duyệt. Kiểm tra yêu cầu của tôi.",
  TAG_NOT_ACTIVE:
    "Một tag không còn hiệu lực. Tìm lại tag hoặc bỏ tag đó trước khi lưu.",
  PUBLISHED_SKILL_IMMUTABLE:
    "Kỹ năng chính không được thay đổi sau khi bài đã xuất bản.",
  REQUEST_EXPIRED:
    "Bài đã hết hạn và không còn nhận đề nghị. Tạo bài mới nếu vẫn muốn học.",
  REQUEST_LOCKED: "Bài đã có thỏa thuận khóa, không thể hủy qua bài đăng.",
  REQUEST_NOT_PUBLISHABLE:
    "Chỉ xuất bản từ bản nháp. Bài bị từ chối cần chỉnh sửa và lưu trước.",
  INVALID_REQUEST_INPUT:
    "Nội dung bài, tag hoặc kỹ năng trao đổi không còn hợp lệ. Kiểm tra lại lựa chọn và lịch rảnh.",
  INVALID_CREDIT_HINT:
    "Credit gợi ý chưa đúng giới hạn của hình thức trao đổi. Chỉnh lại hoặc để trống để trao đổi sau.",
  CONNECTION_POLICY_UNAVAILABLE:
    "Máy chủ chưa cung cấp đủ chính sách cho gợi ý này. Thử bỏ gợi ý Credit/thời lượng hoặc thử lại sau.",
  FILE_NOT_CLEAN:
    "Tệp chưa được quét sạch. Chờ trạng thái kiểm tra trước khi gửi.",
  ATTACHMENT_NOT_AVAILABLE:
    "Tệp không còn khả dụng hoặc bạn đã mất quyền tải. Tải lại cuộc trò chuyện.",
  FILE_TOO_LARGE: "Tệp vượt quá dung lượng được phép.",
  PAYMENT_UNRESOLVED:
    "Bạn có lệnh nạp chưa hoàn tất. Kiểm tra lệnh hiện tại trước khi tạo lệnh khác.",
  PAYMENT_RECONCILIATION_REQUIRED:
    "Lệnh nạp trước cần đối soát. Mở lệnh đó và kiểm tra trạng thái.",
  PAYMENT_CHANNEL_RECONCILIATION_REQUIRED:
    "Kênh thanh toán đang đối soát các lệnh cũ; tạm thời chưa tạo được lệnh mới.",
  PAYMENT_CREATION_PAUSED:
    "Kênh nạp đang tạm dừng tạo lệnh mới. Các lệnh cũ vẫn cần kiểm tra trạng thái riêng.",
  PAYMENT_PROVIDER_UNAVAILABLE:
    "Nhà cung cấp thanh toán chưa sẵn sàng. Hãy kiểm tra lại sau.",
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
    "Phòng học chưa có cấu hình thời gian mở. Hãy kiểm tra lại sau hoặc liên hệ hỗ trợ.",
  LIVEKIT_DISABLED: "Máy chủ chưa bật phòng học.",
  JOIN_WINDOW_NOT_OPEN: "Chưa đến giờ mở phòng.",
  JOIN_WINDOW_CLOSED: "Đã hết giờ vào phòng.",
  SESSION_ATTENDANCE_NOT_MET: "Điểm danh chưa đủ điều kiện xác nhận hoàn tất.",
  ATTENDANCE_PENDING: "Hệ thống đang tổng hợp điểm danh. Hãy tải lại sau.",
  CONFIRM_WINDOW_CLOSED: "Đã hết thời hạn xác nhận hoàn tất.",
  TEACHER_SKILL_NOT_ELIGIBLE:
    "Bạn cần khai báo kỹ năng phù hợp trước khi gửi đề xuất.",
  PROPOSAL_ALREADY_PENDING: "Bạn đã gửi đề xuất cho bài này. Xem mục Kết nối.",
  SELF_PROPOSAL: "Bạn không thể gửi lời mời cho chính mình.",
  DIRECT_TARGET_UNAVAILABLE:
    "Kỹ năng này không còn nhận lời mời. Tải lại hồ sơ hoặc chọn người chia sẻ khác.",
  SHARING_SKILL_ARCHIVED: "Kỹ năng đã được lưu trữ và không còn nhận lời mời.",
  SHARING_SKILL_NOT_VISIBLE:
    "Kỹ năng đã được ẩn. Hãy chọn một kỹ năng công khai khác.",
  DIRECT_INVITATION_COOLDOWN:
    "Bạn đã gửi lời mời cho người này ở kỹ năng này gần đây. Xem đề nghị đã gửi và chờ hết thời gian giới hạn trước khi mời lại.",
  PROPOSAL_RATE_LIMIT:
    "Bạn đã đạt giới hạn gửi đề nghị. Hãy chờ rồi thử lại; các đề nghị đã gửi vẫn ở mục Kết nối.",
  REQUEST_NOT_AVAILABLE: "Bài học không còn nhận đề xuất.",
  STALE_SCHEDULE_VERSION:
    "Lịch đã thay đổi. Tải lại và xác nhận phiên bản mới.",
  REQUEST_VERSION_CONFLICT: "Bài viết đã đổi. Tải lại trước khi thao tác.",
  COMMAND_UNCERTAIN:
    "Chưa xác định kết quả lần gửi trước. Hãy kiểm tra trạng thái trước khi gửi yêu cầu khác.",
};
export function userErrorText(status: number, code: string) {
  if (messages[code]) return messages[code];
  const translated = knownSystemMessage(code);
  if (translated) return translated;
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
  if (
    options.method === "POST" &&
    /^conversations\/[^/]+\/messages$/.test(path) &&
    options.body &&
    typeof options.body === "object" &&
    "messageText" in options.body &&
    typeof options.body.messageText === "string"
  )
    if (findContactInformation(options.body.messageText))
      throw new UserApiError(400, "CONTACT_INFORMATION_BLOCKED");
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
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  }
  if (!response.ok)
    throw new UserApiError(
      response.status,
      responseCode(value),
      value && typeof value === "object" && "details" in value
        ? value.details
        : value,
    );
  return successReply<T>(value);
}
