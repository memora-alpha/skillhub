import { knownSystemMessage } from "@/lib/system-text";
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
  VOUCHER_REDEMPTION_DISABLED:
    "Đổi voucher hiện chưa được mở. Bạn vẫn có thể xem danh mục và lịch sử.",
  VOUCHER_REDEMPTION_NOT_FOUND:
    "Không có đơn đổi thưởng phát sinh từ yêu cầu đã lưu.",
  REWARD_PRICE_CHANGED:
    "Giá voucher đã thay đổi. Kiểm tra lại yêu cầu cũ rồi xem và xác nhận giá mới.",
  REWARD_NOT_AVAILABLE: "Voucher này hiện không còn sẵn sàng để đổi.",
  REWARD_PERMISSION_REQUIRED:
    "Tài khoản chưa có quyền thực hiện thao tác phần thưởng này.",
  VOUCHER_USER_LIMIT_EXCEEDED:
    "Bạn đã đạt hạn mức Credit đổi voucher trong ngày.",
  VOUCHER_BUDGET_EXCEEDED:
    "Ngân sách voucher hôm nay đã hết. Vui lòng thử lại sau.",
  MATERIAL_VERSION_CONFLICT:
    "Tài liệu đã thay đổi. Hãy đóng và mở lại để xem phiên bản mới.",
  MATERIAL_CONTENT_LOCKED:
    "Tài liệu đã từng xuất bản nên không thể sửa nội dung hoặc giá. Hãy chia sẻ tài liệu mới.",
  MATERIAL_ACTION_UNAVAILABLE:
    "Trạng thái tài liệu đã thay đổi. Tải lại để xem thao tác phù hợp.",
  MATERIAL_REVIEW_EDIT_BLOCKED:
    "Quyền đánh giá đã thay đổi. Tải lại đánh giá trước khi tiếp tục.",
  CONTENT_MODERATION_BLOCKED:
    "Nội dung hoặc tệp đính kèm vi phạm tiêu chuẩn cộng đồng. Vui lòng chỉnh sửa rồi thử lại.",
  CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE:
    "Hệ thống kiểm duyệt nội dung đang tạm bận. Vui lòng thử lại sau ít phút.",
  FILE_FORMAT_UNSUPPORTED:
    "Định dạng tệp này không được hỗ trợ cho mục tải lên này.",
  MATERIAL_COVER_NOT_READY:
    "Ảnh bìa chưa hoàn tất kiểm tra an toàn. Vui lòng chờ hoặc chọn ảnh khác.",
  CONTACT_INFORMATION_NOT_ALLOWED:
    "Hãy bỏ số điện thoại, email hoặc thông tin liên hệ riêng trước khi gửi. Bạn có thể trao đổi ngay trong SkillHub.",
  REPORT_POLICY_UNAVAILABLE:
    "Chưa xác định được thời hạn báo cáo. Vui lòng thử lại sau.",
  INVALID_SCHEDULE_ITEMS: "Một số buổi học cần điều chỉnh trước khi chốt lịch.",
  CASE_HANDLER_REQUIRED:
    "Vụ việc đang chờ người phụ trách. Bạn vẫn có thể bổ sung bằng chứng nếu được phép.",
  REPORT_CASE_CLOSED: "Vụ việc đã đóng, không thể gửi thêm nội dung.",
  CASE_EVIDENCE_LIMIT: "Bạn đã gửi tối đa 5 bằng chứng cho vụ việc này.",
  MATERIAL_REFUND_WINDOW_CLOSED: "Đã quá hạn hoàn đơn 24 giờ.",
  MATERIAL_ALREADY_CONSUMED:
    "Đơn đã lấy liên kết tải nên không thể hoàn tự động.",
  MATERIAL_REFUND_ADMIN_REQUIRED:
    "Số dư bên bán chưa đủ để hoàn tự động. Cần nhân sự hỗ trợ xử lý.",
  CREDIT_PROVENANCE_REVIEW_REQUIRED:
    "Đơn mua cần được bộ phận hỗ trợ kiểm tra nguồn Credit trước khi hoàn.",
  MATERIAL_ALREADY_REFUNDED: "Đơn mua đã được hoàn Credit.",
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
  TAG_REQUEST_PENDING:
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
  ACCOUNT_NOT_ACTIVE:
    "Tài khoản hiện chưa thể đăng nhập. Vui lòng liên hệ hỗ trợ SkillHub để kiểm tra trạng thái tài khoản.",
  EMAIL_ALREADY_EXISTS:
    "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
  EMAIL_ALREADY_REGISTERED:
    "Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.",
  OTP_INVALID_OR_EXPIRED:
    "Mã không đúng, đã hết hạn hoặc đang bị giới hạn. Vui lòng kiểm tra lại.",
  RESET_TOKEN_INVALID_OR_EXPIRED:
    "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.",
  INVALID_REFRESH_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  ACTIVE_MATERIAL_REPORT_EXISTS:
    "Bạn đã có báo cáo đang xử lý cho tài liệu này.",
  DUPLICATE_REPORT_EVIDENCE: "Bằng chứng bị trùng. Bỏ tệp trùng rồi gửi lại.",
  CASE_MESSAGE_ID_REUSED:
    "Nội dung gửi lại đã thay đổi. Tải lại trao đổi để kiểm tra.",
  CHAT_RATE_LIMIT:
    "Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi trước khi gửi tiếp.",
  EVENT_CONNECTION_LIMIT:
    "Đã đạt giới hạn kết nối cập nhật. Đóng bớt tab đang mở và đợi kết nối lại.",
  FILE_FORMAT_MISMATCH:
    "Nội dung tệp không khớp với phần mở rộng hoặc định dạng đã khai báo.",
  FILE_NAME_INVALID:
    "Tên tệp không hợp lệ. Hãy đổi tên tệp không chứa ký tự đặc biệt rồi thử lại.",
  FILE_EMPTY_OR_INVALID: "Tệp rỗng hoặc không đọc được dữ liệu hợp lệ.",
  FILE_ARCHIVE_EXPANSION_LIMIT_EXCEEDED:
    "Tệp tài liệu có cấu trúc nén vượt giới hạn an toàn.",
  FILE_POLICY_UNAVAILABLE:
    "Chưa thể kiểm tra chính sách tệp lúc này. Vui lòng thử lại sau.",
  FILE_STORAGE_UNAVAILABLE:
    "Dịch vụ lưu trữ tệp đang tạm gián đoạn. Vui lòng thử lại sau.",
  FILE_NOT_READY:
    "Tệp chưa được quét an toàn xong. Kiểm tra trạng thái tệp trước khi gửi.",
  MATERIAL_PRICE_CHANGED:
    "Giá hoặc phiên bản tài liệu đã đổi. Tải lại và kiểm tra trước khi xác nhận mua.",
  MATERIAL_ACCESS_DENIED: "Bạn không có quyền truy cập tài liệu này.",
  MATERIAL_ACCESS_CHANGED:
    "Hình thức truy cập tài liệu đã thay đổi. Tải lại trước khi tiếp tục.",
  MATERIAL_RIGHTS_CONFIRMATION_REQUIRED:
    "Bạn cần xác nhận quyền chia sẻ tài liệu trước khi gửi duyệt.",
  MATERIAL_DELETE_NOT_ALLOWED:
    "Không thể xóa tài liệu ở trạng thái hiện tại hoặc đã có người mua.",
  MATERIAL_ALREADY_OWNED: "Bạn đã có quyền truy cập tài liệu này.",
  MATERIAL_NOT_PURCHASABLE: "Tài liệu hiện không đủ điều kiện mua.",
  MATERIAL_FILE_REQUIRED: "Tài liệu cần có tệp hợp lệ trước khi gửi duyệt.",
  MATERIAL_TRANSITION_INVALID:
    "Tài liệu đã đổi trạng thái. Tải lại danh sách trước khi thao tác.",
  PATH_ALREADY_LEARNING_FINISHED:
    "Các buổi học đã hoàn thành. Mở mục quyết toán để theo dõi Credit.",
  RECOVERY_MISSION_INCOMPLETE:
    "Nhiệm vụ chưa đủ điều kiện. Hoàn thành các bước rồi kiểm tra lại.",
  RECOVERY_MISSION_NOT_ELIGIBLE:
    "Nhiệm vụ này không còn áp dụng cho tài khoản của bạn. Hãy tải lại mục uy tín.",
  RECOVERY_QUIZ_VERSION_OR_LENGTH_INVALID:
    "Bài kiểm tra đã cập nhật. Tải lại câu hỏi để làm tiếp.",
  RESCHEDULE_CUTOFF_OR_STATE_VIOLATION:
    "Buổi học đã quá hạn đổi lịch hoặc không còn ở trạng thái cho phép đổi lịch.",
  ABSENCE_EXCUSE_EXISTS: "Bạn đã gửi lý do vắng mặt cho buổi học này.",
  ABSENCE_EXCUSE_NOT_ALLOWED:
    "Buổi học hiện không đủ điều kiện gửi lý do vắng mặt.",
  ABSENCE_EXCUSE_NOT_PENDING:
    "Yêu cầu xác nhận lý do vắng mặt không còn ở trạng thái chờ xử lý.",
  PAYMENT_ALREADY_PAID: "Lệnh nạp này đã được thanh toán thành công.",
  PAYMENT_CHANNEL_UNAVAILABLE:
    "Kênh thanh toán tạm thời chưa sẵn sàng. Vui lòng thử lại sau.",
  PAYMENT_CHECKOUT_BUSY:
    "Hệ thống đang khởi tạo liên kết thanh toán. Vui lòng chờ giây lát.",
  PROPOSAL_EXPIRED: "Đề nghị này đã hết hạn và không thể thao tác tiếp.",
  PROPOSAL_VERSION_CONFLICT:
    "Đề nghị đã thay đổi. Tải lại để xem thông tin mới nhất.",
  VERIFICATION_PENDING: "Kỹ năng này đang có yêu cầu xác minh chờ duyệt.",
  SKILL_DUPLICATE: "Bạn đã thêm kỹ năng này vào hồ sơ chia sẻ.",
  SKILL_NOT_ACTIVE: "Kỹ năng này không còn hoạt động trong danh mục.",
  SKILL_LEVEL_NOT_ACTIVE:
    "Cấp độ kỹ năng đã chọn không còn hoạt động. Hãy chọn cấp độ khác.",
  SESSION_BLOCKED_BY_DISPUTE:
    "Buổi học đang có tranh chấp chưa giải quyết nên chưa thể thao tác.",
  SESSION_NOT_ENDED: "Buổi học chưa kết thúc.",
  CHANGE_REQUEST_ALREADY_DECIDED:
    "Yêu cầu thay đổi đã có phản hồi. Tải lại để xem kết quả.",
  CHANGE_REQUEST_CLOSED: "Yêu cầu thay đổi đã đóng.",
  RATE_LIMITED: "Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi một lát.",
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
  WHITEBOARD_POLICY_NOT_READY:
    "Cấu hình bảng trắng chưa sẵn sàng. Vui lòng thử lại sau.",
  WHITEBOARD_READ_ONLY:
    "Bảng trắng đang ở chế độ chỉ đọc nên chưa thể lưu thay đổi.",
  WHITEBOARD_REVISION_CONFLICT:
    "Bảng trắng vừa có cập nhật mới từ phía còn lại. Đang đồng bộ lại.",
  WHITEBOARD_SCENE_TOO_LARGE:
    "Nội dung bảng trắng vượt quá giới hạn 2 MB. Hãy xóa bớt nét vẽ cũ.",
  INVALID_WHITEBOARD_SCENE: "Dữ liệu bảng trắng chưa đúng định dạng.",
  SESSION_UNDER_REPORT:
    "Buổi học đang có báo cáo mở nên bảng trắng được khóa chỉ đọc để giữ nguyên bằng chứng.",
  SESSION_NOT_EDITABLE:
    "Trạng thái buổi học hiện tại không cho phép chỉnh sửa bảng trắng.",
  EDIT_WINDOW_NOT_OPEN: "Chưa đến khung giờ cho phép chỉnh sửa bảng trắng.",
  EDIT_WINDOW_CLOSED: "Đã hết thời hạn chỉnh sửa bảng trắng của buổi học.",
  RECORDING_DISABLED: "Tính năng ghi hình buổi học hiện chưa được bật.",
  RECORDING_UNAVAILABLE:
    "Dịch vụ ghi hình hoặc lưu trữ bản ghi hiện chưa sẵn sàng.",
  RECORDING_ALREADY_ACTIVE:
    "Buổi học đã có yêu cầu hoặc phiên ghi hình đang hoạt động.",
  RECORDING_WINDOW_NOT_OPEN:
    "Chỉ có thể ghi hình trong khung giờ mở phòng khi buổi học đang sẵn sàng hoặc diễn ra.",
  RECORDING_ROOM_NOT_STARTED:
    "Cần có người tham gia đã vào phòng học trước khi bắt đầu ghi hình.",
  RECORDING_STATE_CONFLICT:
    "Trạng thái ghi hình đã thay đổi. Đang tải lại trạng thái mới nhất.",
  RECORDING_ACTION_NOT_ALLOWED:
    "Chỉ người còn lại mới có thể đồng ý hoặc từ chối yêu cầu ghi hình.",
  RECORDING_NOT_FOUND: "Không tìm thấy bản ghi buổi học này.",
  RECORDING_NOT_READY:
    "Bản ghi chưa sẵn sàng phát lại hoặc đã hết thời hạn lưu trữ.",
  RECORDING_HELD_BY_REPORT:
    "Bản ghi đang được tạm giữ vì buổi học có báo cáo tranh chấp đang mở nên chưa thể xóa.",
  RECORDING_PLAN_REQUIRED:
    "Gói hiện tại chưa bao gồm tính năng ghi hình buổi học. Hãy nâng cấp gói thành viên tại mục Gói thành viên.",
  RECORDING_MINUTES_EXHAUSTED:
    "Bạn đã dùng hết hạn mức phút ghi hình trong kỳ này. Hãy mua thêm gói phút ghi hình hoặc nâng cấp gói thành viên.",
  RECORDING_ALREADY_CHARGED: "Bản ghi này đã được tính vào hạn mức phút.",
  MATERIAL_STORAGE_QUOTA_EXCEEDED:
    "Bạn đã vượt quá dung lượng lưu trữ tài liệu của gói hiện tại. Hãy xóa bớt tệp cũ hoặc nâng cấp gói thành viên.",
  SUBSCRIPTIONS_DISABLED:
    "Tính năng đăng ký và nâng cấp gói thành viên hiện đang tạm đóng.",
  SUBSCRIPTION_ALREADY_ACTIVE:
    "Bạn đang có gói thành viên còn hiệu lực. Hãy dùng chức năng nâng cấp hoặc đổi chu kỳ gia hạn.",
  SUBSCRIPTION_NOT_ACTIVE:
    "Bạn cần có gói thành viên đang hoạt động để thực hiện thao tác này.",
  SUBSCRIPTION_NOT_AN_UPGRADE:
    "Gói đã chọn không cao hơn gói hiện tại. Hãy dùng tùy chọn chuyển gói cho kỳ gia hạn kế tiếp.",
  SUBSCRIPTION_NOT_FOUND:
    "Không tìm thấy gói thành viên đang hoạt động của tài khoản.",
  SUBSCRIPTION_PERMISSION_REQUIRED:
    "Tài khoản hiện không có quyền quản lý gói thành viên.",
  SUBSCRIPTION_PLAN_CHANGED:
    "Giá hoặc phiên bản gói vừa thay đổi. Hãy tải lại trang để xác nhận mức giá mới.",
  SUBSCRIPTION_PLAN_INVALID:
    "Cấu hình quyền lợi gói thành viên chưa hợp lệ. Vui lòng thử lại sau.",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Gói thành viên đã chọn hiện không còn mở bán.",
  SUBSCRIPTION_QUOTE_CHANGED:
    "Báo giá nâng cấp đã thay đổi theo thời gian thực. Hãy lấy lại báo giá rồi xác nhận.",
  SUBSCRIPTION_RENEWAL_PENDING:
    "Gói của bạn đang trong quá trình xử lý gia hạn cuối kỳ. Vui lòng đợi ít phút rồi tải lại.",
  SUBSCRIPTION_VERSION_CONFLICT:
    "Trạng thái gói thành viên vừa được cập nhật. Hãy tải lại trang trước khi tiếp tục.",
  USE_UPGRADE_ENDPOINT:
    "Để chuyển lên gói cao hơn ngay lập tức, hãy dùng thao tác Nâng cấp gói.",
  RECORDING_ADDON_NOT_ALLOWED:
    "Gói hiện tại chưa hỗ trợ mua thêm phút ghi hình. Hãy nâng cấp lên gói Creator hoặc Creator Pro.",
  RECORDING_ADDON_PACKS_INVALID:
    "Số gói phút ghi hình mua mỗi lần phải từ 1 đến 10 gói.",
  RECORDING_ADDON_PRICE_CHANGED:
    "Giá gói phút ghi hình vừa thay đổi. Hãy kiểm tra lại giá hiện hành và xác nhận lại.",
  PAYMENT_CANCELLATION_UNCONFIRMED:
    "Chưa xác nhận được trạng thái hủy lệnh nạp từ cổng thanh toán. Hãy tải lại kiểm tra sau ít phút.",
  IDEMPOTENCY_KEY_REQUIRED:
    "Thiếu khóa chống gửi trùng yêu cầu. Hãy tải lại trang rồi thực hiện lại.",
  IDEMPOTENCY_KEY_REUSED:
    "Yêu cầu vừa gửi bị trùng khóa với tham số khác. Hãy tải lại trạng thái rồi thử lại.",
  CHAT_DOWNLOAD_UNAVAILABLE:
    "Dịch vụ tải tệp tin nhắn tạm thời chưa sẵn sàng. Vui lòng thử lại sau.",
  CHAT_REPLICA_SET_OR_INDEXES_UNAVAILABLE:
    "Hệ thống tin nhắn đang tạm thời bảo trì. Vui lòng thử lại sau ít phút.",
  CHAT_STORE_UNAVAILABLE:
    "Dịch vụ lưu trữ tin nhắn đang tạm gián đoạn. Vui lòng thử lại sau.",
  COMMITTED_DRAFT_MISSING:
    "Tin nhắn đang được đồng bộ lại. Hãy tải lại cuộc trò chuyện để kiểm tra.",
  MESSAGE_NOT_READY:
    "Tin nhắn chưa sẵn sàng hiển thị. Hãy tải lại sau ít giây.",
  EVENT_CONNECTIONS_UNAVAILABLE:
    "Kênh cập nhật trực tuyến đang tạm gián đoạn. Hệ thống sẽ tự kết nối lại.",
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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
