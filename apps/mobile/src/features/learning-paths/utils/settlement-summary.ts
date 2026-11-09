import type { SettlementStatus } from "../api/path-changes-contract";

export function earlyConsentNote(status: SettlementStatus) {
  const partnerApproved = !!status.immediateSettlement?.partnerApprovedAt;
  if (["WAITING_DISPUTE_WINDOW", "READY"].includes(status.status)) {
    if (partnerApproved) return "Cả hai đã đồng ý · Đang xử lý quyết toán.";
    return "Bạn đã đồng ý · Chờ đối tác hoặc hết thời gian chờ.";
  }
  if (partnerApproved) return "Đã ghi nhận đồng ý quyết toán sớm của cả hai.";
  return "Đã ghi nhận đồng ý quyết toán sớm của bạn.";
}

export function settlementWaitNote(status: SettlementStatus, now = Date.now()) {
  if (!status.autoSettlementAt) return "Khi hết thời gian chờ và đủ điều kiện";
  const remaining = Date.parse(status.autoSettlementAt) - now;
  if (remaining <= 0) return "Hệ thống đang kiểm tra điều kiện";
  const hours = Math.ceil(remaining / 3_600_000);
  return `Sau khoảng ${hours} giờ`;
}

export const settlementWarnings: Partial<
  Record<SettlementStatus["status"], string>
> = {
  WAITING_DISPUTE: "Quyết toán tạm giữ do tranh chấp.",
  WAITING_TERMINATION: "Quyết toán đang chờ xử lý yêu cầu hủy lộ trình.",
  RETRYING:
    "Hệ thống đang tự thử lại quyết toán. Credit chưa được xác nhận đã chuyển.",
  NEEDS_REVIEW: "Quyết toán cần được hỗ trợ xử lý.",
};
