import type { PaymentObservationRead } from "../types/payment";

// Presentation only. Success can come only from an accepted backend PAID read.
export function simplePaymentCopy(
  state: PaymentObservationRead,
  hasQr = false,
) {
  const showAmount =
    ["ready", "refreshing", "refresh-error"].includes(state.status) &&
    !!state.data;
  const outcome = showAmount ? state.data!.state : undefined;
  const success = outcome === "PAID";
  let title = "Chưa thể kiểm tra thanh toán",
    description = "Vui lòng thử lại sau.";
  if (state.status === "unavailable") {
    title = "Thanh toán chưa sẵn sàng";
    description = "Bạn có thể quay lại ví và thử sau.";
  } else if (state.status === "loading") {
    title = "Đang tải thanh toán";
    description = "Vui lòng chờ trong giây lát.";
  } else if (["denied", "not-found", "session-ended"].includes(state.status)) {
    title = "Không thể mở thanh toán";
    description = "Quay lại ví hoặc đăng nhập đúng tài khoản để tiếp tục.";
  } else if (outcome === "PAID") {
    title = "Thanh toán thành công";
    description = "Bạn có thể xem số dư mới trong ví Credit.";
  } else if (outcome === "CREATED") {
    title = "Đang chuẩn bị mã QR";
    description = "Yêu cầu nạp đã được tạo. Mã QR sẽ hiển thị khi sẵn sàng.";
  } else if (outcome === "PENDING") {
    title = hasQr ? "Quét mã để thanh toán" : "Đang chờ thanh toán";
    description = hasQr
      ? "Dùng ứng dụng ngân hàng trên thiết bị khác để quét mã."
      : "Mã QR hiện chưa sẵn sàng. Kiểm tra lại để cập nhật.";
  } else if (outcome === "REVIEW") {
    title = "Thanh toán đang được kiểm tra";
    description = "Yêu cầu của bạn đang được đối soát. Vui lòng quay lại sau.";
  } else if (outcome === "FAILED") {
    title = "Thanh toán không thành công";
    description =
      "Bạn có thể quay lại ví để xem thông tin hoặc nạp lại khi được phép.";
  } else if (outcome === "EXPIRED") {
    title = "Yêu cầu đã hết hạn";
    description = "Quay lại ví để bắt đầu lần nạp khác.";
  } else if (outcome === "CANCELLED") {
    title = "Yêu cầu nạp đã hủy";
    description = "Quay lại ví để bắt đầu lần nạp khác khi được phép.";
  } else if (outcome === "REFUNDED") {
    title = "Đã ghi nhận hoàn tiền";
    description = "Xem lịch sử để kiểm tra thông tin giao dịch.";
  } else if (outcome) {
    title = "Đang kiểm tra thanh toán";
    description = "Chưa có kết quả xác nhận. Vui lòng kiểm tra lại sau.";
  }
  if (
    state.recoveryReason === "PAYMENT_RECOVERY_PENDING" &&
    ["CREATED", "PENDING"].includes(outcome ?? "")
  )
    description = "Yêu cầu nạp đang được khôi phục. Vui lòng chờ cập nhật.";
  else if (!success && state.recoveryRequired && outcome !== "REVIEW")
    description =
      "Thanh toán đang tạm gián đoạn. Vui lòng kiểm tra lại yêu cầu này sau.";
  return {
    title,
    description,
    success,
    showAmount,
    error: ["FAILED", "EXPIRED"].includes(outcome ?? ""),
    canCheck:
      ![
        "loading",
        "refreshing",
        "denied",
        "not-found",
        "session-ended",
        "unavailable",
      ].includes(state.status) &&
      (!success || state.stale),
  };
}
