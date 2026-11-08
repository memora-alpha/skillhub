import { AppError } from "@/lib/http/errors";

const rejections: Readonly<Record<string, string>> = {
  TAG_NOT_ACTIVE:
    "Một tag đã chọn không còn hoạt động. Hãy chỉnh sửa yêu cầu, bỏ hoặc chọn lại tag trước khi lưu hay đăng bài.",
  SKILL_NOT_ACTIVE:
    "Kỹ năng đã chọn không còn hoạt động. Hãy kiểm tra và chọn kỹ năng đang hoạt động trước khi gửi yêu cầu.",
  SHARING_SKILL_CHANGED:
    "Thông tin kỹ năng có thể dạy đã thay đổi. Hãy chỉnh sửa yêu cầu và chọn lại kỹ năng có thể dạy trước khi lưu hay đăng bài.",
  SHARING_SKILL_ARCHIVED:
    "Một kỹ năng có thể dạy đã được lưu trữ. Hãy chỉnh sửa yêu cầu để bỏ hoặc thay kỹ năng này trước khi lưu hay đăng bài.",
  SHARING_SKILL_NOT_VISIBLE:
    "Một kỹ năng có thể dạy không còn công khai. Hãy công khai kỹ năng đó hoặc chọn kỹ năng khác trước khi lưu hay đăng bài.",
  CONNECTION_PARTY_UNAVAILABLE:
    "Tài khoản hiện chưa đủ điều kiện thực hiện thao tác này. Hãy kiểm tra xác minh email và trạng thái tài khoản trong Hồ sơ; xem các hạn chế đang áp dụng trong mục Uy tín.",
};

export function requestRejectionMessage(error: unknown) {
  if (
    error instanceof AppError &&
    error.kind === "http" &&
    error.status === 409 &&
    error.code
  )
    return rejections[error.code];
  return undefined;
}
