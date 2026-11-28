import type { RewardProduct } from "./reward-contract";

export type VoucherSortOption =
  "default" | "price-asc" | "price-desc" | "value-desc";

export type RedemptionTone =
  "success" | "progress" | "warn" | "refunded" | "neutral";

export type CategoryOption = {
  name: string;
  count: number;
};

export type BrandOption = {
  id: string;
  name: string;
  count: number;
};

/** Format an integer VND string with Vietnamese thousand separators, e.g. "500.000 đ". */
export function formatVnd(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(-?)(\d+)$/.exec(trimmed);
  if (!match) return "—";
  const [, sign, whole] = match;
  return `${sign}${BigInt(whole!).toLocaleString("vi-VN")} đ`;
}

/**
 * Format exact Credit strings cleanly: strips redundant trailing all-zero
 * decimals ("500.00" -> "500") while keeping meaningful fractions ("98.20" -> "98,20").
 */
export function formatCreditAmount(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return "—";
  const [, sign, whole, fraction] = match;
  const formattedWhole = `${sign}${BigInt(whole!).toLocaleString("vi-VN")}`;
  if (!fraction || /^0+$/.test(fraction)) return formattedWhole;
  return `${formattedWhole},${fraction}`;
}

/** Format a computed numeric Credit value (such as shortfall or projected balance). */
export function formatComputedCredit(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return formatCreditAmount(
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2),
  );
}

export function parseCreditValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeCreditShortfall(
  priceCredit: string,
  availableCredit: number | null,
): number {
  const price = parseCreditValue(priceCredit);
  if (price === null || availableCredit === null || availableCredit >= price) {
    return 0;
  }
  return Math.ceil((price - availableCredit) * 100) / 100;
}

export function computeRemainingCredit(
  priceCredit: string,
  availableCredit: number | null,
): number | null {
  const price = parseCreditValue(priceCredit);
  if (price === null || availableCredit === null) return null;
  return Math.round((availableCredit - price) * 100) / 100;
}

/** Normalize Vietnamese text for forgiving, diacritic-insensitive client search. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .trim();
}

export function brandInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s&/.-]+/)
    .filter(Boolean);
  if (words.length === 0) return "SH";
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export function brandToneIndex(seed: string): 0 | 1 | 2 | 3 {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 4096;
  }
  return (Math.abs(hash) % 4) as 0 | 1 | 2 | 3;
}

export function redemptionStatusTone(status: string): RedemptionTone {
  switch (status) {
    case "ISSUED":
      return "success";
    case "ISSUING":
      return "progress";
    case "MANUAL_REVIEW":
      return "warn";
    case "FAILED_REFUNDED":
    case "REFUNDED_MANUAL":
      return "refunded";
    default:
      return "neutral";
  }
}

export function redemptionStatusHint(status: string): string {
  switch (status) {
    case "ISSUED":
      return "Voucher đã sẵn sàng sử dụng. Nhấn nút bên dưới để mở mã bảo mật khi bạn cần dùng.";
    case "ISSUING":
      return "Hệ thống đang kết nối nhà cung cấp để phát hành mã. Trạng thái sẽ tự động cập nhật sau vài giây.";
    case "MANUAL_REVIEW":
      return "Giao dịch đang được đội ngũ hỗ trợ đối soát để đảm bảo quyền lợi Credit của bạn. Trạng thái tự cập nhật định kỳ.";
    case "FAILED_REFUNDED":
      return "Nhà cung cấp chưa thể phát hành mã lúc này. Toàn bộ Credit đã được tự động hoàn lại vào ví của bạn.";
    case "REFUNDED_MANUAL":
      return "Yêu cầu đã được đối soát xong và toàn bộ Credit đã được hoàn trả về ví của bạn.";
    default:
      return "Theo dõi trạng thái đổi thưởng tại đây hoặc trong mục Lịch sử đổi thưởng.";
  }
}

export function extractCategories(
  products: readonly RewardProduct[],
): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const item of products) {
    if (!item.category) continue;
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

export function extractBrands(
  products: readonly RewardProduct[],
  activeCategory: string,
): BrandOption[] {
  const map = new Map<string, BrandOption>();
  for (const item of products) {
    if (activeCategory && item.category !== activeCategory) continue;
    const current = map.get(item.brand.id);
    if (current) {
      current.count += 1;
    } else {
      map.set(item.brand.id, {
        id: item.brand.id,
        name: item.brand.name,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export function filterAndSortProducts(
  products: readonly RewardProduct[],
  options: Readonly<{
    query: string;
    sort: VoucherSortOption;
    affordableOnly: boolean;
    availableCredit: number | null;
  }>,
): RewardProduct[] {
  const needle = normalizeSearchText(options.query);

  const filtered = products.filter((item) => {
    if (options.affordableOnly && options.availableCredit !== null) {
      const price = parseCreditValue(item.priceCredit);
      if (price === null || price > options.availableCredit) return false;
    }
    if (!needle) return true;
    const haystack = normalizeSearchText(
      [
        item.name,
        item.brand.name,
        item.category ?? "",
        item.faceValueVnd,
        formatVnd(item.faceValueVnd),
      ].join(" "),
    );
    return haystack.includes(needle);
  });

  if (options.sort === "default") return filtered;

  return [...filtered].sort((a, b) => {
    if (options.sort === "price-asc") {
      return (
        (parseCreditValue(a.priceCredit) ?? Number.MAX_SAFE_INTEGER) -
        (parseCreditValue(b.priceCredit) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (options.sort === "price-desc") {
      return (
        (parseCreditValue(b.priceCredit) ?? -1) -
        (parseCreditValue(a.priceCredit) ?? -1)
      );
    }
    return Number(b.faceValueVnd) - Number(a.faceValueVnd);
  });
}
