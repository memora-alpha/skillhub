import { AppError, errorMessage } from "@/lib/http/errors";

export function avatarSaveErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (error.status === 413)
      return "Ảnh đại diện tối đa 5MB. Hãy chọn ảnh nhỏ hơn.";
    if (
      error.status === 415 ||
      error.code === "INVALID_IMAGE" ||
      error.code === "MIME_MISMATCH"
    )
      return "Ảnh không hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WebP khác.";
    if (
      error.kind === "network" ||
      error.kind === "protocol" ||
      error.status >= 500
    )
      return "Chưa xác nhận được thay đổi ảnh. Hãy kiểm tra hồ sơ trước khi thử lại; ảnh đã chọn vẫn được giữ.";
  }
  return errorMessage(error);
}
