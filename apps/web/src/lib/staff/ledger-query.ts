export const ledgerReferenceTypes = [
  "PAYMENT",
  "LEARNING_PATH",
  "SESSION",
  "REVIEW",
  "DISPUTE",
  "MATERIAL_ORDER",
  "SYSTEM",
] as const;
export type LedgerFilters = {
  userId: string;
  type: string;
  status: string;
  operationId: string;
  referenceType: string;
  referenceId: string;
  from: string;
  before: string;
  transactionId: string;
};
export const emptyLedgerFilters: LedgerFilters = {
  userId: "",
  type: "",
  status: "",
  operationId: "",
  referenceType: "",
  referenceId: "",
  from: "",
  before: "",
  transactionId: "",
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function ledgerQuery(filters: LedgerFilters) {
  for (const key of ["userId", "operationId", "transactionId"] as const)
    if (filters[key] && !uuid.test(filters[key]))
      throw new Error(
        "Nhập đầy đủ mã người dùng, giao dịch hoặc nghiệp vụ hợp lệ.",
      );
  if (
    filters.referenceType &&
    !(ledgerReferenceTypes as readonly string[]).includes(filters.referenceType)
  )
    throw new Error("Chọn nguồn tham chiếu hợp lệ.");
  if (filters.referenceId.length > 255)
    throw new Error("Mã tham chiếu tối đa 255 ký tự.");
  const params = new URLSearchParams({ limit: "20", includeTotal: "true" });
  for (const key of [
    "userId",
    "type",
    "status",
    "operationId",
    "referenceType",
    "referenceId",
  ] as const)
    if (filters[key]) params.set(key, filters[key]);
  const stamps: number[] = [];
  for (const key of ["from", "before"] as const) {
    if (!filters[key]) continue;
    const value = filters[key];
    const date = new Date(value + ":00.000Z");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 16) !== value
    )
      throw new Error("Chọn thời gian hợp lệ theo UTC.");
    params.set(key, date.toISOString());
    stamps.push(date.getTime());
  }
  if (stamps.length === 2 && stamps[0]! >= stamps[1]!)
    throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
  return params;
}
export function readLedgerFilters(
  values: Record<string, string | string[] | undefined>,
): LedgerFilters {
  const filters = { ...emptyLedgerFilters };
  for (const key of Object.keys(filters) as (keyof LedgerFilters)[]) {
    const value = values[key];
    if (typeof value === "string") filters[key] = value;
  }
  for (const key of ["from", "before"] as const) {
    const value = filters[key];
    if (
      value &&
      Number.isFinite(Date.parse(value)) &&
      /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    )
      filters[key] = new Date(value).toISOString().slice(0, 16);
  }
  return filters;
}
export function ledgerHref(filters: LedgerFilters) {
  const params = ledgerQuery(filters);
  params.delete("limit");
  params.delete("includeTotal");
  params.set("tab", "ledger");
  if (filters.transactionId) params.set("transactionId", filters.transactionId);
  return "/admin/credits?" + params;
}
/** Link only reference types with an existing administrative detail screen. */
export function ledgerReferenceHref(type: string, id: string): string | null {
  if (!uuid.test(id)) return null;
  const value = encodeURIComponent(id);
  if (type === "PAYMENT")
    return `/admin/credits?tab=payments&paymentId=${value}`;
  if (type === "LEARNING_PATH") return `/admin/learning-paths/${value}`;
  if (type === "DISPUTE") return `/admin/disputes/${value}`;
  return null;
}
