import { AppError, errorMessage } from "@/lib/http/errors";

export function profileSaveErrorMessage(error: unknown): string {
  if (
    error instanceof AppError &&
    (error.kind === "network" ||
      error.kind === "protocol" ||
      error.status >= 500)
  ) {
    return "Chưa xác nhận được kết quả lưu. Bản nháp vẫn được giữ. Hãy kiểm tra hồ sơ trước khi lưu lại.";
  }
  return errorMessage(error);
}
