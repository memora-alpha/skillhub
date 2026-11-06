import { AppError } from "@/lib/http/errors";

export const OTP_REQUEST_ACKNOWLEDGMENT =
  "Nếu yêu cầu hợp lệ, email hướng dẫn sẽ được gửi. Nếu email đã có tài khoản, hãy đăng nhập hoặc khôi phục mật khẩu.";
export const RESET_UNCERTAIN_GUIDANCE =
  "Chưa xác nhận được kết quả. Hãy thử đăng nhập bằng mật khẩu mới.";

export function isOtpRejected(error: unknown): boolean {
  return error instanceof AppError && error.code === "OTP_INVALID_OR_EXPIRED";
}

export function isResetTokenRejected(error: unknown): boolean {
  return (
    error instanceof AppError && error.code === "RESET_TOKEN_INVALID_OR_EXPIRED"
  );
}

export function isResetOutcomeUncertain(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.kind === "network" || (error.kind === "http" && error.status >= 500))
  );
}
