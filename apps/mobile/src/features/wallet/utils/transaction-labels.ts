import { systemCodeLabel } from "@/constants/system-text";
const labels: Record<string, string> = {
  TOP_UP: "Nạp Credit",
  DAILY_BONUS: "Thưởng hằng ngày",
  FEEDBACK_BONUS: "Thưởng phản hồi",
  HOLD: "Tạm giữ Credit",
  RELEASE: "Giải phóng Credit",
  PATH_RETURN: "Hoàn Credit lộ trình",
  PLATFORM_FEE: "Phí nền tảng",
  TEACHING_PAYMENT: "Thanh toán giảng dạy",
  TEACHING_EARNING: "Thu nhập giảng dạy",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_SALE: "Bán tài liệu",
  REFUND: "Ghi nhận hoàn Credit",
  PENALTY: "Khấu trừ",
  ADJUSTMENT: "Điều chỉnh",
};
const states: Record<string, string> = {
  PENDING: "Đang chờ",
  SUCCESS: "Đã ghi nhận",
  FAILED: "Không thành công",
  REVERSED: "Đã được đảo",
};
export const transactionLabel = (code: string) =>
  labels[code] ?? systemCodeLabel(code, "Giao dịch khác");
export const transactionStatus = (code: string) =>
  states[code] ?? systemCodeLabel(code, "Trạng thái đang được cập nhật");
const references: Record<string, string> = {
  PAYMENT: "Thanh toán",
  LEARNING_PATH: "Lộ trình học",
  SESSION: "Buổi học",
  REVIEW: "Đánh giá",
  DISPUTE: "Tranh chấp",
  MATERIAL_ORDER: "Đơn tài liệu",
  SYSTEM: "Hệ thống",
};
export const referenceLabel = (code: string) =>
  references[code] ?? systemCodeLabel(code, "Hoạt động liên quan");
export const transactionTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
