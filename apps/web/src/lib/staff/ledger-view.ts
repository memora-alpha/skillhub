export type LedgerEntry = {
  id: string;
  userId: string;
  operationId: string;
  type: string;
  status: string;
  createdAt: string;
  amount: string;
  availableDelta: string;
  heldDelta: string;
  availableAfter: string;
  heldAfter: string;
  reversesTransactionId: string | null;
  operationIdRecord: {
    referenceType: string;
    referenceId: string;
    operationType: string;
  };
};
export type LedgerOperation = {
  id: string;
  operationType: string;
  referenceType: string;
  referenceId: string;
  status: string;
  createdAt: string;
  entries: LedgerEntry[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Dữ liệu giao dịch chưa đầy đủ. Vui lòng tải lại để kiểm tra.",
    );
  return value as Record<string, unknown>;
}
function field(row: Record<string, unknown>, name: string, pattern?: RegExp) {
  const value = row[name];
  if (typeof value !== "string" || !value || (pattern && !pattern.test(value)))
    throw new Error(
      "Dữ liệu giao dịch chưa đầy đủ. Vui lòng tải lại để kiểm tra.",
    );
  return value;
}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const decimal = /^-?\d+(?:\.\d{1,2})?$/;
const code = /^[A-Z][A-Z0-9_]{0,127}$/;
function timestamp(row: Record<string, unknown>) {
  const value = field(row, "createdAt");
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(
      "Thời gian giao dịch chưa hợp lệ. Vui lòng tải lại để kiểm tra.",
    );
  return value;
}
function reference(value: unknown) {
  const row = record(value);
  return {
    referenceType: field(row, "referenceType", code),
    referenceId: field(row, "referenceId"),
    operationType: field(row, "operationType", code),
  };
}

/** Select display fields explicitly; extra response properties never enter the UI. */
export function readLedgerEntry(value: unknown): LedgerEntry {
  const row = record(value);
  if (
    row.reversesTransactionId !== null &&
    (typeof row.reversesTransactionId !== "string" ||
      !uuid.test(row.reversesTransactionId))
  )
    throw new Error(
      "Mã đối chiếu giao dịch chưa hợp lệ. Vui lòng tải lại để kiểm tra.",
    );
  return {
    id: field(row, "id", uuid),
    userId: field(row, "userId", uuid),
    operationId: field(row, "operationId", uuid),
    type: field(row, "type", code),
    status: field(row, "status", code),
    createdAt: timestamp(row),
    amount: field(row, "amount", decimal),
    availableDelta: field(row, "availableDelta", decimal),
    heldDelta: field(row, "heldDelta", decimal),
    availableAfter: field(row, "availableAfter", decimal),
    heldAfter: field(row, "heldAfter", decimal),
    reversesTransactionId: row.reversesTransactionId as string | null,
    operationIdRecord: reference(row.operationIdRecord),
  };
}
export function readLedgerOperation(value: unknown): LedgerOperation {
  const row = record(value);
  if (!Array.isArray(row.entries))
    throw new Error(
      "Chưa đọc được các bút toán của nghiệp vụ. Vui lòng tải lại.",
    );
  return {
    id: field(row, "id", uuid),
    ...reference(row),
    status: field(row, "status", code),
    createdAt: timestamp(row),
    entries: row.entries.map(readLedgerEntry),
  };
}
