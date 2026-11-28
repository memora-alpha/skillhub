import type {
  PlanEntitlements,
  SubscriptionInterval,
  SubscriptionPlan,
} from "@/features/learner/types";

const planLabels: Record<string, string> = {
  FREE: "Miễn phí",
  CREATOR: "Creator",
  PRO: "Creator Pro",
};

const planTaglines: Record<string, string> = {
  FREE: "Khởi đầu học tập và trao đổi kỹ năng 1:1 với đầy đủ tính năng cơ bản.",
  CREATOR:
    "Phù hợp người dạy & học đều đặn: ghi hình buổi học, lưu bảng trắng dài hơn và giảm phí nền tảng.",
  PRO: "Tối ưu cho người hướng dẫn chuyên sâu với hạn mức lưu trữ lớn, ghi hình dài và ưu đãi phí cao nhất.",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  GRACE: "Đang chờ gia hạn",
  EXPIRED: "Đã hết hạn",
  DRAFT: "Bản nháp",
  APPROVED: "Đã duyệt",
  RETIRED: "Đã ngừng bán",
};

const intervalLabels: Record<string, string> = {
  MONTH: "Theo tháng",
  YEAR: "Theo năm",
};

const chargeLabels: Record<string, string> = {
  PURCHASE: "Đăng ký gói",
  RENEWAL: "Gia hạn định kỳ",
  UPGRADE: "Nâng cấp gói",
  RECORDING_ADDON: "Mua thêm phút ghi hình",
};

export function planDisplayName(code: string | null | undefined): string {
  if (!code) return "Miễn phí";
  return planLabels[code] ?? code;
}

export function planTagline(code: string | null | undefined): string {
  if (!code) return planTaglines.FREE!;
  return planTaglines[code] ?? planTaglines.FREE!;
}

export function subscriptionStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

export function intervalLabel(interval: string): string {
  return intervalLabels[interval] ?? interval;
}

export function intervalPeriodLabel(interval: SubscriptionInterval): string {
  return interval === "MONTH" ? "30 ngày" : "365 ngày";
}

export function chargeKindLabel(kind: string): string {
  return chargeLabels[kind] ?? kind;
}

export function formatStorageBytes(rawBytes: string): string {
  if (!/^\d+$/.test(rawBytes)) return rawBytes;
  const bytes = BigInt(rawBytes);
  const gb = 1_000_000_000n;
  const mb = 1_000_000n;
  const kb = 1_000n;
  if (bytes >= gb) {
    const whole = bytes / gb;
    const tenths = (bytes % gb) / 100_000_000n;
    return tenths > 0n ? `${whole},${tenths} GB` : `${whole} GB`;
  }
  if (bytes >= mb) {
    const whole = bytes / mb;
    const tenths = (bytes % mb) / 100_000n;
    return tenths > 0n ? `${whole},${tenths} MB` : `${whole} MB`;
  }
  if (bytes >= kb) {
    return `${bytes / kb} KB`;
  }
  return `${bytes} B`;
}

export function storageUsagePercent(
  usedBytes: string,
  allowedBytes: string,
): number {
  if (!/^\d+$/.test(usedBytes) || !/^\d+$/.test(allowedBytes)) return 0;
  const allowed = BigInt(allowedBytes);
  if (allowed <= 0n) return 0;
  const used = BigInt(usedBytes);
  const pct = (used * 100n) / allowed;
  return Number(pct > 100n ? 100n : pct);
}

export function recordingUsagePercent(used: number, allowed: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(allowed) || allowed <= 0)
    return 0;
  return Math.min(100, Math.max(0, Math.round((used / allowed) * 100)));
}

export function computeAnnualSavings(
  monthPrice: string,
  yearPrice: string,
): {
  savedCredit: number;
  percent: number;
  monthlyEquivalent: number;
} | null {
  const month = Number(monthPrice);
  const year = Number(yearPrice);
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month <= 0 ||
    year <= 0
  )
    return null;
  const annualized = month * 12;
  const monthlyEquivalent = Math.round((year / 12) * 10) / 10;
  if (year >= annualized) {
    return { savedCredit: 0, percent: 0, monthlyEquivalent };
  }
  const savedCredit = Math.round((annualized - year) * 100) / 100;
  const percent = Math.round(((annualized - year) / annualized) * 100);
  return { savedCredit, percent, monthlyEquivalent };
}

export function maxAnnualSavingsPercent(
  plans: readonly Pick<SubscriptionPlan, "monthPrice" | "yearPrice">[],
): number {
  let best = 0;
  for (const plan of plans) {
    const info = computeAnnualSavings(plan.monthPrice, plan.yearPrice);
    if (info && info.percent > best) best = info.percent;
  }
  return best;
}

export function feeTierLabel(tier: string | null): string {
  if (!tier) return "Bậc phí cơ bản";
  return `Bậc phí ${planDisplayName(tier)}`;
}

export function formatEntitlementHighlights(
  entitlements: PlanEntitlements,
): { label: string; value: string }[] {
  const recordingText =
    entitlements.recordingMinutesPerPeriod > 0
      ? `${entitlements.recordingMinutesPerPeriod} phút/kỳ (lưu ${entitlements.recordingRetentionDays} ngày)`
      : "Chưa bao gồm ghi hình";
  return [
    { label: "Bậc phí nền tảng", value: feeTierLabel(entitlements.feeTier) },
    {
      label: "Dung lượng tài liệu",
      value: formatStorageBytes(entitlements.materialStorageBytes),
    },
    {
      label: "Lưu bảng trắng",
      value: `${entitlements.whiteboardRetentionDays} ngày sau buổi học`,
    },
    { label: "Ghi hình buổi học", value: recordingText },
    {
      label: "Mua thêm phút ghi hình",
      value: entitlements.recordingAddonAllowed ? "Có hỗ trợ" : "Không hỗ trợ",
    },
  ];
}
