enum AppErrorKind { network, http, protocol, config, storage, session }

class AppError implements Exception {
  const AppError(this.kind, {this.status = 0, this.code = ''});

  const AppError.session() : this(AppErrorKind.session);
  const AppError.protocol() : this(AppErrorKind.protocol);

  final AppErrorKind kind;
  final int status;
  final String code;

  @override
  String toString() => 'AppError(${kind.name}, $status, $code)';
}

const otpErrorMessage =
    'Mã không đúng, đã hết hạn hoặc đang bị giới hạn. Sai 5 lần có thể bị chặn OTP 24 giờ; gửi lại mã không gỡ giới hạn. Mật khẩu hợp lệ vẫn dùng để đăng nhập được.';

const _messages = {
  'MATERIAL_REFUND_WINDOW_CLOSED': 'Đã quá hạn hoàn đơn 24 giờ.',
  'MATERIAL_ALREADY_CONSUMED':
      'Đơn đã lấy liên kết tải nên không thể hoàn tự động.',
  'MATERIAL_REFUND_ADMIN_REQUIRED':
      'Số dư bên bán chưa đủ để hoàn tự động. Cần nhân sự hỗ trợ xử lý.',
  'MATERIAL_ORDER_NOT_REFUNDABLE':
      'Trạng thái đơn hiện không cho phép hoàn. Làm mới để kiểm tra.',
  'MATERIAL_ENTITLEMENT_NOT_ACTIVE':
      'Quyền tải của đơn không còn hoạt động. Cần nhân sự hỗ trợ kiểm tra.',
  'SESSION_MAKEUP_LIMIT_REACHED':
      'Buổi này đã dùng lượt học bù; cần nhân sự xem xét nếu còn vấn đề.',
  'USER_MAKEUP_LIMIT_REACHED':
      'Người yêu cầu đã hết lượt học bù trong thỏa thuận.',
  'MAKEUP_ATTRIBUTION_REVIEW_REQUIRED':
      'Lịch sử học bù cần nhân sự xác minh người sử dụng lượt.',
  'SESSION_RESCHEDULE_LIMIT_REACHED': 'Buổi này đã đổi lịch đủ 3 lần.',
  'RESCHEDULE_SESSION_ORDER_VIOLATION':
      'Giờ mới phải giữ đúng thứ tự các buổi trong kế hoạch.',
  'LAST_SESSION_RESCHEDULE_WINDOW_EXCEEDED':
      'Buổi cuối chỉ được dời tối đa 48 giờ so với lịch gốc.',
  'ACTIVE_SESSION_REPORT_EXISTS':
      'Bạn đã có báo cáo đang xử lý cho buổi này. Mở Báo cáo của tôi để theo dõi.',
  'DISPUTE_WINDOW_CLOSED': 'Đã hết thời hạn gửi báo cáo cho buổi học này.',
  'REVIEW_NOT_OPEN':
      'Đánh giá mở sau khi toàn bộ lộ trình hoàn thành và đã quyết toán.',
  'REVIEW_ALREADY_SUBMITTED': 'Bạn đã gửi đánh giá cho lộ trình này.',
  'EMAIL_ALREADY_EXISTS':
      'Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.',
  'EMAIL_ALREADY_REGISTERED':
      'Email đã được sử dụng. Hãy đăng nhập hoặc khôi phục mật khẩu.',
  'NEW_ACTIVITY_RESTRICTED':
      'Tài khoản đang bị hạn chế tạo bài hoặc đề xuất mới. Xem mục Uy tín để biết lý do và thời hạn; bạn vẫn có thể theo dõi hoạt động đã có quyền truy cập.',
  'INVALID_CREDENTIALS': 'Email hoặc mật khẩu chưa đúng.',
  'ACCOUNT_NOT_ACTIVE':
      'Tài khoản chưa thể đăng nhập. Nếu chưa xác minh email, hãy xác minh trước.',
  'OTP_INVALID_OR_EXPIRED': otpErrorMessage,
  'RESET_TOKEN_INVALID_OR_EXPIRED':
      'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.',
  'INVALID_REFRESH_TOKEN':
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  'INSUFFICIENT_AVAILABLE_CREDIT':
      'Một trong hai tài khoản không đủ Credit khả dụng để tạm giữ.',
  'SCHEDULE_CONFLICT':
      'Các buổi bị trùng giờ với nhau hoặc với lịch đề xuất / buổi học khác.',
  'SCHEDULE_ITEMS_OVERLAP':
      'Các buổi trong đề xuất trùng giờ hoặc không đúng thứ tự thời gian.',
  'INVALID_SCHEDULE_ITEMS':
      'Lịch chưa hợp lệ. Buổi học phải ở tương lai và dài từ 60 đến 180 phút.',
  'SCHEDULE_NOT_CONFIRMED': 'Chưa đủ xác nhận lịch của cả hai bên.',
  'REQUIRED_SCHEDULE_PROPOSAL_MISSING':
      'Mỗi kế hoạch cần một đề xuất lịch của phiên bản hiện tại.',
  'LEARNING_PATH_NOT_CONFIRMED': 'Chưa đủ xác nhận điều khoản của cả hai bên.',
  'LEARNING_PLAN_NOT_CONFIRMED': 'Người học chưa xác nhận đủ kế hoạch.',
  'REQUIRED_LEARNING_PLANS_MISSING': 'Chưa đủ kế hoạch cho hình thức học này.',
  'SESSION_NOT_ENDED': 'Chỉ xác nhận hoàn thành sau giờ kết thúc buổi học.',
  'SESSION_NOT_FOUND': 'Không tìm thấy buổi học. Tải lại rồi thử lại.',
  'SESSION_ACCESS_DENIED': 'Bạn không phải người tham gia buổi học này.',
  'SESSION_NOT_JOINABLE': 'Buổi học này không vào phòng được.',
  'SESSION_CANNOT_BE_COMPLETED': 'Buổi học đã hủy hoặc đang tranh chấp.',
  'SESSION_BLOCKED_BY_DISPUTE':
      'Buổi học đang bị khóa vì lộ trình có tranh chấp.',
  'JOIN_WINDOW_NOT_OPEN': 'Chưa đến giờ mở phòng.',
  'JOIN_WINDOW_CLOSED': 'Đã hết giờ vào phòng.',
  'LIVEKIT_DISABLED': 'Phòng học chưa được bật trên hệ thống.',
  'LIVEKIT_POLICY_NOT_READY': 'Chưa có cấu hình giờ mở phòng.',
  'CHAT_RATE_LIMIT': 'Bạn gửi tin nhắn hơi nhanh. Đợi một chút rồi gửi lại.',
  'PROPOSAL_RATE_LIMIT':
      'Bạn đã đạt giới hạn gửi đề xuất. Vui lòng thử lại sau.',
  'RATE_LIMITED': 'Máy chủ đang giới hạn tạm thời. Đợi một chút rồi thử lại.',
  'PATH_SESSIONS_INCOMPLETE': 'Còn buổi học chưa hoàn thành.',
  'DISPUTE_WINDOW_OPEN':
      'Chưa hết thời gian khiếu nại sau buổi cuối. Hãy quyết toán sau.',
  'SETTLEMENT_BLOCKED_BY_DISPUTE':
      'Đang có khiếu nại nên chưa quyết toán được.',
  'LEARNING_PATH_NOT_SETTLEABLE': 'Lộ trình chưa đủ điều kiện quyết toán.',
  'INVALID_SESSION_DATE_RANGE': 'Khoảng ngày buổi học không hợp lệ.',
  'SKILL_DUPLICATE': 'Kỹ năng này đã có trong hồ sơ. Hãy kiểm tra danh sách.',
  'SKILL_NOT_ACTIVE': 'Kỹ năng này không còn trong danh mục.',
  'SKILL_LEVEL_NOT_ACTIVE':
      'Trình độ này không còn dùng cho kỹ năng đã chọn. Hãy chọn trình độ khác.',
  'FILE_REQUIRED': 'Chọn một tệp trước khi gửi.',
  'FILE_FORMAT_UNSUPPORTED': 'Chỉ nhận tệp pdf, docx, pptx hoặc xlsx.',
  'FILE_FORMAT_MISMATCH': 'Định dạng tệp không khớp phần mở rộng.',
  'FILE_TOO_LARGE': 'Tệp vượt quá 20 MB.',
  'FILE_NOT_READY': 'Tệp chưa được kiểm tra xong.',
  'MATERIAL_SKILL_INVALID': 'Kỹ năng này không còn trong danh mục.',
  'MATERIAL_RIGHTS_CONFIRMATION_REQUIRED':
      'Cần xác nhận quyền phân phối tài liệu.',
  'MATERIAL_VERSION_CONFLICT': 'Tài liệu đã thay đổi. Tải lại trước khi sửa.',
  'MATERIAL_TRANSITION_INVALID':
      'Tài liệu không còn ở trạng thái cho phép thao tác này.',
  'MATERIAL_NOT_EDITABLE': 'Tài liệu này không còn sửa được.',
  'MATERIAL_FILE_REQUIRED': 'Tài liệu cần một tệp đã được kiểm tra.',
  'MATERIAL_NOT_PAID': 'Tài liệu miễn phí không cần mua.',
  'MATERIAL_SELF_PURCHASE': 'Bạn không mua tài liệu của chính mình.',
  'MATERIAL_ACCESS_DENIED': 'Bạn chưa có quyền mở tệp này.',
  'MATERIAL_NOT_PUBLISHED': 'Tài liệu chưa được công bố.',
  'MATERIAL_PRICE_INVALID':
      'Giá không khớp cách chia sẻ. Miễn phí phải là 0, trả phí phải lớn hơn 0.',
  'MATERIAL_TEXT_INVALID': 'Tên hoặc mô tả chưa đúng độ dài cho phép.',
  'MATERIAL_NOT_FOUND': 'Không tìm thấy tài liệu.',
  'MATERIAL_FILE_NOT_FOUND': 'Không tìm thấy tệp của tài liệu.',
  'MATERIAL_PRICE_CHANGED': 'Giá hoặc phiên bản đã đổi. Tải lại trước khi mua.',
  'MATERIAL_FEE_POLICY_UNAVAILABLE':
      'Chưa có chính sách phí nên chưa mua được.',
  'FILE_NOT_FOUND': 'Không tìm thấy tệp.',
};

String knownMessage(String? code, String fallback) =>
    code == null ? fallback : _messages[code] ?? fallback;

/// Background GET failures that should not replace the screen with an error card.
bool isTransientReadError(Object? error) {
  if (error is! AppError) return false;
  if (error.kind == AppErrorKind.network) return true;
  if (error.kind != AppErrorKind.http) return false;
  return error.status == 429 || error.status == 502 || error.status == 503;
}

String errorMessage(Object? error) {
  if (error is! AppError) return 'Không thể hoàn tất. Vui lòng thử lại.';
  final message = _messages[error.code];
  if (message != null) return message;
  switch (error.kind) {
    case AppErrorKind.network:
      return 'Không thể kết nối. Kiểm tra mạng và thử lại.';
    case AppErrorKind.config:
      return 'Chưa cấu hình địa chỉ máy chủ hợp lệ.';
    case AppErrorKind.storage:
      return 'Không thể lưu phiên đăng nhập an toàn trên thiết bị.';
    case AppErrorKind.session:
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case AppErrorKind.http:
    case AppErrorKind.protocol:
      break;
  }
  if (error.status == 429) {
    return knownMessage(
      error.code,
      'Máy chủ đang giới hạn tạm thời. Đợi một chút rồi thử lại.',
    );
  }
  if (error.status == 400) {
    return 'Thông tin chưa hợp lệ. Kiểm tra lại và thử lại.';
  }
  if (error.status == 403) {
    return 'Tài khoản hiện không có quyền thực hiện thao tác này.';
  }
  if (error.status == 404) {
    return knownMessage(
      error.code,
      'Không tìm thấy buổi học hoặc API không còn endpoint này.',
    );
  }
  return 'Không thể hoàn tất. Vui lòng thử lại.';
}
