import { AppError, errorMessage } from "@/lib/http/errors";
import type {
  Interval,
  Plan,
  Subscription,
} from "../api/subscription-contracts";

export const planName = (code?: string | null) =>
  ({ CREATOR: "Creator", PRO: "Pro" })[code ?? ""] ?? "Miễn phí";
export const intervalName = (interval: Interval) =>
  interval === "MONTH" ? "30 ngày" : "365 ngày";
export const planPrice = (plan: Plan, interval: Interval) =>
  interval === "MONTH" ? plan.monthPrice : plan.yearPrice;
export function creditLabel(value: string) {
  const [whole, decimal] = value.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimal && decimal !== "00" ? `,${decimal}` : ""} Credit`;
}
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export function storageLabel(value: string) {
  const bytes = BigInt(value);
  const units = [
    [1_000_000_000n, "GB"],
    [1_000_000n, "MB"],
    [1_000n, "KB"],
  ] as const;
  for (const [size, unit] of units) {
    if (bytes >= size) {
      const tenths = (bytes * 10n) / size;
      return `${tenths / 10n}${tenths % 10n ? `,${tenths % 10n}` : ""} ${unit}`;
    }
  }
  return `${bytes} B`;
}
export function usagePercent(used: string, allowed: string) {
  const total = BigInt(allowed);
  if (total === 0n) return 0;
  return Number(
    (BigInt(used) * 100n) / total > 100n ? 100n : (BigInt(used) * 100n) / total,
  );
}
export function planAction(
  plan: Plan,
  interval: Interval,
  current: Subscription | null,
) {
  if (!current) return "purchase";
  if (current.planCode === plan.planCode && current.interval === interval)
    return "current";
  if (current.planCode === "CREATOR" && plan.planCode === "PRO") {
    return current.status === "ACTIVE" && current.interval === interval
      ? "upgrade"
      : "unavailable";
  }
  return "schedule";
}
const failures: Record<string, string> = {
  SUBSCRIPTION_NATIVE_REQUIRED:
    "Đăng ký và nâng cấp gói trong ứng dụng SkillHub trên điện thoại. Bạn vẫn có thể quản lý gia hạn tại đây.",
  SUBSCRIPTIONS_DISABLED:
    "Đăng ký và nâng cấp đang tạm dừng. Vui lòng thử lại sau.",
  SUBSCRIPTION_PERMISSION_REQUIRED:
    "Tài khoản chưa được cấp quyền quản lý gói thành viên.",
  SUBSCRIPTION_ALREADY_ACTIVE:
    "Bạn đã có gói thành viên. Hãy tải lại để xem gói hiện tại.",
  SUBSCRIPTION_PLAN_CHANGED:
    "Giá hoặc quyền lợi đã thay đổi. Tải lại và xác nhận gói mới.",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Gói này hiện chưa được mở đăng ký.",
  SUBSCRIPTION_QUOTE_CHANGED:
    "Báo giá nâng cấp đã thay đổi. Hãy lấy báo giá mới trước khi xác nhận.",
  SUBSCRIPTION_VERSION_CONFLICT:
    "Gói đã được cập nhật ở nơi khác. Tải lại trước khi thao tác tiếp.",
  SUBSCRIPTION_RENEWAL_PENDING:
    "Gói đang được xử lý gia hạn. Vui lòng tải lại sau ít phút.",
  SUBSCRIPTION_NOT_ACTIVE:
    "Gói hiện không thể nâng cấp. Hãy kiểm tra trạng thái mới nhất.",
  SUBSCRIPTION_NOT_AN_UPGRADE: "Chưa thể nâng cấp sang gói đã chọn.",
  SUBSCRIPTION_NOT_FOUND: "Bạn chưa có gói thành viên đang hoạt động.",
  USE_UPGRADE_ENDPOINT: "Hãy chọn nâng cấp để đổi sang gói cao hơn.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Credit khả dụng chưa đủ. Hãy kiểm tra ví trước khi đăng ký.",
  IDEMPOTENCY_KEY_REUSED:
    "Chưa thể đối chiếu yêu cầu trước. Vui lòng liên hệ hỗ trợ trước khi thử giao dịch mới.",
};
export function subscriptionFailure(error: unknown): string {
  if (error instanceof AppError) {
    const message = failures[error.code];
    if (message) return message;
    if (error.kind === "storage")
      return "Chưa thể đọc hoặc lưu yêu cầu trên thiết bị. Vui lòng thử lại trước khi đăng ký.";
  }
  return errorMessage(error);
}
