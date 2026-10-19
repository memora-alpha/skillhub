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
    'Mã không đúng hoặc đã hết hạn. Nếu sai 5 lần, hãy thử lại sau 24 giờ.';

const _messages = {
  'INVALID_CREDENTIALS': 'Email hoặc mật khẩu chưa đúng.',
  'ACCOUNT_NOT_ACTIVE':
      'Tài khoản chưa thể đăng nhập. Nếu chưa xác minh email, hãy xác minh trước.',
  'OTP_INVALID_OR_EXPIRED': otpErrorMessage,
  'RESET_TOKEN_INVALID_OR_EXPIRED':
      'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.',
  'INVALID_REFRESH_TOKEN': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
};

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
    return 'Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.';
  }
  if (error.status == 400) {
    return 'Thông tin chưa hợp lệ. Kiểm tra lại và thử lại.';
  }
  if (error.status == 403) {
    return 'Tài khoản hiện không có quyền thực hiện thao tác này.';
  }
  return 'Không thể hoàn tất. Vui lòng thử lại.';
}
