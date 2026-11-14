import { AppError, errorMessage } from "./errors";
import { FileSelectionError } from "./picked-image";

export type FilePickerPhase = "selection" | "upload" | "status";

export function filePickerError(
  error: unknown,
  phase: FilePickerPhase,
  formats?: string,
): string {
  if (error instanceof FileSelectionError) return error.message;
  if (error instanceof AppError) {
    switch (error.code) {
      case "FILE_STORAGE_UNAVAILABLE":
        return "Kho lưu trữ tệp đang không khả dụng. Vui lòng thử lại sau.";
      case "FILE_POLICY_UNAVAILABLE":
        return "Máy chủ chưa sẵn sàng nhận tệp. Vui lòng thử lại sau.";
      case "FILE_FORMAT_MISMATCH":
        return "Nội dung tệp không khớp với định dạng. Hãy mở và xuất lại tệp gốc rồi chọn lại.";
      case "FILE_NAME_INVALID":
        return "Tên tệp chưa hợp lệ. Hãy đổi tên tệp ngắn gọn, giữ đúng phần mở rộng rồi chọn lại.";
      case "FILE_EMPTY_OR_INVALID":
        return "Tệp rỗng hoặc không đọc được. Hãy kiểm tra tệp gốc rồi chọn lại.";
      case "FILE_OBJECT_MISMATCH":
        return "Tệp tải lên chưa toàn vẹn. Hãy chọn lại tệp và thử tải lại.";
      case "FILE_REQUIRED":
        return "Máy chủ chưa nhận được tệp. Hãy chọn lại tệp và thử tải lên.";
    }
    if (error.status === 413)
      return "Tệp vượt dung lượng máy chủ cho phép. Hãy chọn tệp nhỏ hơn.";
    if (error.status === 415)
      return formats
        ? `Máy chủ không chấp nhận tệp này. Chọn tệp ${formats}; tệp cần có nội dung đúng định dạng và không được mã hóa.`
        : "Định dạng hoặc nội dung tệp không được hỗ trợ. Hãy xuất lại tệp gốc rồi chọn lại.";
    if (error.status === 401)
      return "Phiên tải tệp đã hết hạn. Hãy chọn lại tệp để tải lên một lần nữa.";
    if (error.status === 400)
      return "Máy chủ chưa nhận được tệp hợp lệ. Hãy kiểm tra định dạng và chọn lại tệp.";
    if (error.status === 404 && phase === "status")
      return "Không tìm thấy tệp đã tải lên. Hãy chọn lại tệp hoặc kiểm tra quyền truy cập.";
    if (error.kind === "protocol")
      return "Máy chủ trả về kết quả tệp không hợp lệ. Chưa thể xác nhận tệp đã tải lên.";
    if (error.status >= 500)
      return "Máy chủ chưa xử lý được tệp. Vui lòng thử lại sau.";
    return errorMessage(error);
  }
  if (phase === "selection")
    return "Không đọc được tệp đã chọn. Nếu tệp ở iCloud hoặc Drive, hãy tải về thiết bị trong ứng dụng Tệp rồi chọn lại.";
  return phase === "upload"
    ? "Không tải được tệp lên. Hãy chọn lại tệp và thử tải lại."
    : "Chưa kiểm tra được trạng thái tệp. Vui lòng thử kiểm tra lại.";
}
