import type { PaymentObservationModel, PaymentState } from "../types/payment";
const captions: Record<PaymentState | "UNKNOWN", string> = {
  CREATED: "Đã tạo yêu cầu nạp",
  PENDING: "Đang chờ xác minh",
  PAID: "Thanh toán thành công",
  FAILED: "Thanh toán thất bại",
  EXPIRED: "Yêu cầu thanh toán đã hết hạn",
  REFUNDED: "Giao dịch được ghi nhận đã hoàn",
  CANCELLED: "Yêu cầu nạp đã hủy",
  REVIEW: "Thanh toán cần kiểm tra/đối soát",
  UNKNOWN: "Chưa thể xác nhận trạng thái",
};
export const paymentState = (value: string): PaymentState | "UNKNOWN" =>
  Object.hasOwn(captions, value)
    ? (value as PaymentState | "UNKNOWN")
    : "UNKNOWN";
export const paymentOutcome = (state: PaymentObservationModel["state"]) =>
  captions[state];
export const isTerminalPaymentStatus = (status: string) =>
  ["PAID", "FAILED", "EXPIRED", "REFUNDED", "CANCELLED"].includes(status);
