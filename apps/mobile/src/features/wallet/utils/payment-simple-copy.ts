import type { PaymentObservationRead } from "../types/payment";

function outcomeCopy(
  outcome: string | undefined,
  hasQr: boolean,
): [string, string] {
  switch (outcome) {
    case "PAID":
      return [
        "Thanh toán thành công",
        "Bạn có thể xem số dư mới trong ví Credit.",
      ];
    case "CREATED":
      return [
        "Đang chuẩn bị mã QR",
        "Yêu cầu nạp đã được tạo. Mã QR sẽ hiển thị khi sẵn sàng.",
      ];
    case "PENDING":
      if (hasQr)
        return [
          "Quét mã để thanh toán",
          "Dùng ứng dụng ngân hàng trên thiết bị khác để quét mã.",
        ];
      return [
        "Đang chờ thanh toán",
        "Mã QR hiện chưa sẵn sàng. Kiểm tra lại để cập nhật.",
      ];
    case "REVIEW":
      return [
        "Thanh toán đang được kiểm tra",
        "Yêu cầu của bạn đang được đối soát. Vui lòng quay lại sau.",
      ];
    case "FAILED":
      return [
        "Thanh toán không thành công",
        "Bạn có thể quay lại ví để xem thông tin hoặc nạp lại khi được phép.",
      ];
    case "EXPIRED":
      return ["Yêu cầu đã hết hạn", "Quay lại ví để bắt đầu lần nạp khác."];
    case "CANCELLED":
      return [
        "Yêu cầu nạp đã hủy",
        "Quay lại ví để bắt đầu lần nạp khác khi được phép.",
      ];
    case "REFUNDED":
      return [
        "Đã ghi nhận hoàn tiền",
        "Xem lịch sử để kiểm tra thông tin giao dịch.",
      ];
    default:
      if (outcome)
        return [
          "Đang kiểm tra thanh toán",
          "Chưa có kết quả xác nhận. Vui lòng kiểm tra lại sau.",
        ];
      return ["Chưa thể kiểm tra thanh toán", "Vui lòng thử lại sau."];
  }
}

function statusCopy(
  status: PaymentObservationRead["status"],
  outcome: string | undefined,
  hasQr: boolean,
): [string, string] {
  switch (status) {
    case "unavailable":
      return ["Thanh toán chưa sẵn sàng", "Bạn có thể quay lại ví và thử sau."];
    case "loading":
      return ["Đang tải thanh toán", "Vui lòng chờ trong giây lát."];
    case "denied":
    case "not-found":
    case "session-ended":
      return [
        "Không thể mở thanh toán",
        "Quay lại ví hoặc đăng nhập đúng tài khoản để tiếp tục.",
      ];
    default:
      return outcomeCopy(outcome, hasQr);
  }
}

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
  const [title, initialDescription] = statusCopy(state.status, outcome, hasQr);
  let description = initialDescription;
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
