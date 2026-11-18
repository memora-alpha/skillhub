import {
  emptyLedgerFilters,
  ledgerQuery,
  readLedgerFilters,
} from "./ledger-query";
export type PaymentFilters = {
  userId: string;
  orderCode: string;
  gatewayTransactionId: string;
  from: string;
  before: string;
  paidFrom: string;
  paidBefore: string;
};
export const emptyPaymentFilters: PaymentFilters = {
  userId: "",
  orderCode: "",
  gatewayTransactionId: "",
  from: "",
  before: "",
  paidFrom: "",
  paidBefore: "",
};
export function paymentQuery(filters: PaymentFilters) {
  const params = ledgerQuery({
    ...emptyLedgerFilters,
    userId: filters.userId,
    from: filters.from,
    before: filters.before,
  });
  if (filters.orderCode && !/^[1-9]\d{0,15}$/.test(filters.orderCode))
    throw new Error("Mã đơn cần từ 1 đến 16 chữ số, không bắt đầu bằng 0.");
  if (filters.gatewayTransactionId.length > 255)
    throw new Error("Mã giao dịch cổng thanh toán tối đa 255 ký tự.");
  if (filters.orderCode) params.set("orderCode", filters.orderCode);
  if (filters.gatewayTransactionId)
    params.set("gatewayTransactionId", filters.gatewayTransactionId);
  if (Boolean(filters.paidFrom) !== Boolean(filters.paidBefore))
    throw new Error("Chọn đủ hai mốc thời gian thanh toán.");
  if (filters.paidFrom) {
    const paid = ledgerQuery({
      ...emptyLedgerFilters,
      from: filters.paidFrom,
      before: filters.paidBefore,
    });
    params.set("paidFrom", paid.get("from")!);
    params.set("paidBefore", paid.get("before")!);
  }
  return params;
}
export function readPaymentFilters(
  values: Record<string, string | string[] | undefined>,
): PaymentFilters {
  const base = readLedgerFilters(values);
  const paid = readLedgerFilters({
    from: values.paidFrom,
    before: values.paidBefore,
  });
  return {
    userId: base.userId,
    from: base.from,
    before: base.before,
    paidFrom: paid.from,
    paidBefore: paid.before,
    orderCode: typeof values.orderCode === "string" ? values.orderCode : "",
    gatewayTransactionId:
      typeof values.gatewayTransactionId === "string"
        ? values.gatewayTransactionId
        : "",
  };
}
