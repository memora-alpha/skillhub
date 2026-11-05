import '../../../core/http/app_error.dart';

const otpRequestAcknowledgment = 'Nếu yêu cầu hợp lệ, email hướng dẫn sẽ được gửi. Nếu email đã có tài khoản, hãy đăng nhập hoặc khôi phục mật khẩu.';
const resetUncertainGuidance =
    'Chưa xác nhận được kết quả. Hãy thử đăng nhập bằng mật khẩu mới.';

bool isResetTokenRejected(Object? error) =>
    error is AppError && error.code == 'RESET_TOKEN_INVALID_OR_EXPIRED';

bool isResetOutcomeUncertain(Object? error) =>
    error is AppError &&
    (error.kind == AppErrorKind.network ||
        (error.kind == AppErrorKind.http && error.status >= 500));
