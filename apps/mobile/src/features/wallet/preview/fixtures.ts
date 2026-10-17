// Explicit synthetic UI models. Never an account API projection or fallback.
export const previewBalances = { available: "180.00", held: "100.00" };
export const previewTransactions = [
  {
    id: "preview-tx-topup",
    type: "TOP_UP",
    amount: "200.00",
    status: "SUCCESS",
    context: "Nạp Credit mẫu",
  },
  {
    id: "preview-tx-hold",
    type: "HOLD",
    amount: "100.00",
    status: "SUCCESS",
    context: "Tạm giữ mẫu; không phải khoản thu nhập",
  },
  {
    id: "preview-tx-fee",
    type: "PLATFORM_FEE",
    amount: "4.00",
    status: "SUCCESS",
    context: "Phí được ghi nhận riêng trong dữ liệu mẫu",
  },
];
export const previewPaymentStates: Record<string, string> = {
  CREATED: "Đã tạo yêu cầu nạp mẫu",
  PENDING: "Đang chờ xác minh mẫu",
  PAID: "Thanh toán mẫu thành công",
  FAILED: "Thanh toán mẫu thất bại",
  EXPIRED: "Yêu cầu mẫu đã hết hạn",
  REFUNDED: "Giao dịch mẫu được ghi nhận đã hoàn",
  UNKNOWN: "Chưa thể xác nhận trạng thái mẫu",
};
