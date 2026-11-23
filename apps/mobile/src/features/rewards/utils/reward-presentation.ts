import { AppError, errorMessage } from "@/lib/http/errors";
import type {
  Redemption,
  RedemptionStatus,
  RewardProduct,
} from "../api/reward-contracts";

export function creditLabel(value: string) {
  const [whole, decimal = "00"] = value.split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped}${decimal === "00" ? "" : `,${decimal}`} Credit`;
}
export function vndLabel(value: string) {
  return `${value.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}
export function filterProducts(
  products: RewardProduct[],
  search: string,
  category: string,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLocaleLowerCase("vi");
  const term = normalize(search.trim());
  return products.filter(
    (item) =>
      (!category || item.category === category) &&
      normalize(`${item.name} ${item.brand.name}`).includes(term),
  );
}
export function redemptionLabel(
  row: Pick<Redemption, "status" | "expiresAt">,
  now = Date.now(),
) {
  if (
    row.status === "ISSUED" &&
    row.expiresAt &&
    Date.parse(row.expiresAt) <= now
  )
    return "Đã hết hạn";
  const labels: Record<RedemptionStatus, string> = {
    ISSUING: "Đang phát hành",
    ISSUED: "Đã phát hành",
    FAILED_REFUNDED: "Đã hoàn Credit",
    MANUAL_REVIEW: "Đang kiểm tra",
    REFUNDED_MANUAL: "Đã hoàn Credit",
  };
  return labels[row.status];
}
export function safeVoucherLink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
const failures: Record<string, string> = {
  VOUCHER_REDEMPTION_DISABLED:
    "Tạm thời chưa thể đổi voucher. Vui lòng thử lại sau.",
  REWARD_PERMISSION_REQUIRED: "Tài khoản chưa được cấp quyền đổi voucher.",
  REWARD_NOT_AVAILABLE:
    "Voucher hiện không còn khả dụng. Hãy chọn voucher khác.",
  REWARD_PRICE_CHANGED:
    "Giá voucher đã thay đổi. Tải lại và kiểm tra trước khi đổi.",
  INSUFFICIENT_PURCHASED_CREDIT:
    "Số Credit đã nạp chưa đủ để đổi voucher này. Vui lòng nạp thêm Credit.",
  INSUFFICIENT_AVAILABLE_CREDIT: "Credit khả dụng chưa đủ để đổi voucher.",
  VOUCHER_USER_LIMIT_EXCEEDED: "Bạn đã đạt hạn mức đổi voucher trong ngày.",
  VOUCHER_BUDGET_EXCEEDED:
    "Hạn mức phát hành hôm nay đã hết. Vui lòng thử lại sau.",
};
export function rewardFailure(error: unknown) {
  if (error instanceof AppError) {
    if (failures[error.code]) return failures[error.code];
    if (error.kind === "storage")
      return "Chưa thể đổi voucher trên thiết bị này. Vui lòng thử lại trong ứng dụng SkillHub.";
    if (error.status === 404)
      return "Voucher không tồn tại hoặc bạn không có quyền xem.";
  }
  return errorMessage(error);
}
