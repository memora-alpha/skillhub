import { AppError } from "@/lib/http/errors";

export const OTP_REQUEST_ACKNOWLEDGMENT =
  "Vui lòng kiểm tra email để lấy mã xác minh.";
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
