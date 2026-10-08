export class AppError extends Error {
  constructor(
    public readonly kind:
      "network" | "http" | "protocol" | "config" | "storage" | "session",
    public readonly status = 0,
    public readonly code = "",
  ) {
    super(kind);
    this.name = "AppError";
  }
}

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu chưa đúng.",
  ACCOUNT_NOT_ACTIVE:
    "Tài khoản chưa thể đăng nhập. Nếu chưa xác minh email, hãy xác minh trước.",
  OTP_INVALID_OR_EXPIRED:
    "Mã không đúng hoặc đã hết hạn. Vui lòng yêu cầu mã mới.",
  INVALID_REFRESH_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
};

export function errorMessage(error: unknown): string {
  if (!(error instanceof AppError))
    return "Không thể hoàn tất. Vui lòng thử lại.";
  const message = messages[error.code];
  if (message) return message;
  if (error.kind === "network")
    return "Không thể kết nối. Kiểm tra mạng và thử lại.";
  if (error.kind === "config") return "Chưa cấu hình địa chỉ máy chủ hợp lệ.";
  if (error.kind === "storage")
    return "Không thể lưu phiên đăng nhập an toàn trên thiết bị.";
  if (error.kind === "session")
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error.status === 429)
    return "Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.";
  if (error.status === 400)
    return "Thông tin chưa hợp lệ. Kiểm tra lại và thử lại.";
  if (error.status === 403)
    return "Tài khoản hiện không có quyền thực hiện thao tác này.";
  return "Không thể hoàn tất. Vui lòng thử lại.";
}
