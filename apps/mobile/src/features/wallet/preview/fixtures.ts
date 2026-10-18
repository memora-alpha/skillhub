// Explicit synthetic UI models. Never an account API projection or fallback.
import { creditAmount, creditDelta } from "../utils/amount";
import type { Transaction } from "../types/transaction";
export const previewBalances = { available: "180.00", held: "100.00" };
export const previewTransactions = [
  {
    id: "preview-tx-topup",
    type: "TOP_UP",
    amount: "200.00",
    status: "SUCCESS",
    context: "Nạp Credit mẫu",
  },
  {
    id: "preview-tx-hold",
    type: "HOLD",
    amount: "100.00",
    status: "SUCCESS",
    context: "Tạm giữ mẫu; không phải khoản thu nhập",
  },
  {
    id: "preview-tx-fee",
    type: "PLATFORM_FEE",
    amount: "4.00",
    status: "SUCCESS",
    context: "Phí được ghi nhận riêng trong dữ liệu mẫu",
  },
];
export const previewPaymentStates: Record<string, string> = {
  CREATED: "Đã tạo yêu cầu nạp mẫu",
  PENDING: "Đang chờ xác minh mẫu",
  PAID: "Thanh toán mẫu thành công",
  FAILED: "Thanh toán mẫu thất bại",
  EXPIRED: "Yêu cầu mẫu đã hết hạn",
  REFUNDED: "Giao dịch mẫu được ghi nhận đã hoàn",
  UNKNOWN: "Chưa thể xác nhận trạng thái mẫu",
};

// Explicit ledger fixture values, never derived from type or account balances.
export const previewLedgerEntries: readonly Transaction[] = [
  {
    id: "preview-tx-topup",
    operationId: "preview-operation-topup",
    type: "TOP_UP",
    status: "SUCCESS",
    amount: creditAmount("200.00"),
    availableDelta: creditDelta("200.00"),
    heldDelta: creditDelta("0.00"),
    availableAfter: creditAmount("280.00"),
    heldAfter: creditAmount("0.00"),
    referenceType: "PAYMENT",
    referenceId: "preview-payment",
    reversesTransactionId: null,
    createdAt: "2026-10-17T09:30:00.000Z",
  },
  {
    id: "preview-tx-hold",
    operationId: "preview-operation-hold",
    type: "HOLD",
    status: "SUCCESS",
    amount: creditAmount("100.00"),
    availableDelta: creditDelta("-100.00"),
    heldDelta: creditDelta("100.00"),
    availableAfter: creditAmount("180.00"),
    heldAfter: creditAmount("100.00"),
    referenceType: "LEARNING_PATH",
    referenceId: "preview-path",
    reversesTransactionId: null,
    createdAt: "2026-10-16T08:00:00.000Z",
  },
  {
    id: "preview-tx-fee",
    operationId: "preview-operation-fee",
    type: "PLATFORM_FEE",
    status: "SUCCESS",
    amount: creditAmount("4.00"),
    availableDelta: creditDelta("0.00"),
    heldDelta: creditDelta("-4.00"),
    availableAfter: creditAmount("180.00"),
    heldAfter: creditAmount("96.00"),
    referenceType: "LEARNING_PATH",
    referenceId: "preview-path",
    reversesTransactionId: null,
    createdAt: "2026-10-15T08:00:00.000Z",
  },
];
