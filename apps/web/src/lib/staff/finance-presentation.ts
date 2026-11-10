import { systemCodeLabel } from "@/lib/system-text";

/** Keep monetary strings exact, including values outside Number's safe range. */
export function financeNumber(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return "—";
  const [, sign, whole, fraction] = match;
  const decimal = fraction ? "," + fraction : "";
  return `${sign}${BigInt(whole!).toLocaleString("vi-VN")}${decimal}`;
}
const labels: Record<string, string> = {
  TWO_WAY: "Trao đổi hai chiều",
  ONE_WAY: "Học một chiều",
  MATERIAL_PAID: "Tài liệu trả phí",
  DRAFT: "Bản nháp",
  APPROVED: "Đã duyệt",
  SETTLEMENT: "Tất toán lộ trình",
  MATERIAL_REFUND: "Hoàn tiền tài liệu",
  REVERSAL: "Hoàn tác giao dịch",
};
export function financeLabel(code: string) {
  return labels[code] ?? systemCodeLabel(code, "Nghiệp vụ khác");
}

/** The report API uses UTC periods and an exclusive upper bound, max 366 days. */
export function feeRevenueQuery(from: string, to: string, granularity: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const stamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(stamp) &&
      new Date(stamp).toISOString().slice(0, 10) === value
      ? stamp
      : NaN;
  };
  const start = parse(from),
    last = parse(to),
    end = last + 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(last) || last < start)
    throw new Error("Chọn ngày bắt đầu và kết thúc hợp lệ.");
  if (end - start > 366 * 86400000)
    throw new Error(
      "Mỗi báo cáo hỗ trợ tối đa 366 ngày. Hãy chọn khoảng ngắn hơn.",
    );
  if (!["day", "month"].includes(granularity))
    throw new Error("Chọn nhóm báo cáo theo ngày hoặc tháng.");
  return new URLSearchParams({
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    granularity,
  }).toString();
}

/** Prefer API identity; content plus occurrence distinguishes repeated scalar results. */
export function keyedFinanceItems(items: readonly unknown[]) {
  const occurrences = new Map<string, number>();
  return items.map((value) => {
    const identity =
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string"
        ? "id:" + value.id
        : "value:" + JSON.stringify(value);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { value, key: identity + ":" + occurrence };
  });
}
