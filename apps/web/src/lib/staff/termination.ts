export type TerminationChange = {
  id: string;
  pathId: string;
  kind: string;
  status: string;
  version: number;
  requesterId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  blockedByDispute: boolean;
  awaitingPolicy: boolean;
};
export type Allocation = {
  allocationId: string;
  userId: string;
  status: string;
  lockedPathVersion: number;
  remainingHeld: string;
};
export type TerminationReview = TerminationChange & {
  execution: {
    digest: string;
    completed: number;
    total: number;
    allocations: Allocation[];
    policyReference: string | null;
  };
};
export type AllocationDecision = {
  allocationId: string;
  refund: string;
  counterpartyPayment: string;
  platformFee: string;
};
export type TerminationDecision = {
  expectedVersion: number;
  expectedExecutionDigest: string;
  policyReference: string;
  reason: string;
  allocations: AllocationDecision[];
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Dữ liệu xem xét chưa hợp lệ.");
  return value as Record<string, unknown>;
}
const validId = (value: unknown) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export function readTerminationChange(value: unknown): TerminationChange {
  const row = record(value);
  if (
    !validId(row.id) ||
    !validId(row.pathId) ||
    !validId(row.requesterId) ||
    row.kind !== "PATH_TERMINATION" ||
    typeof row.status !== "string" ||
    !Number.isInteger(row.version) ||
    Number(row.version) < 1 ||
    typeof row.reason !== "string" ||
    typeof row.blockedByDispute !== "boolean" ||
    typeof row.awaitingPolicy !== "boolean" ||
    typeof row.createdAt !== "string" ||
    typeof row.expiresAt !== "string"
  )
    throw new Error("Yêu cầu dừng lộ trình chưa hợp lệ.");
  return row as TerminationChange;
}
export function readTerminationReview(value: unknown): TerminationReview {
  const row = readTerminationChange(value),
    execution = record(record(value).execution);
  if (
    typeof execution.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(execution.digest) ||
    !Number.isInteger(execution.completed) ||
    !Number.isInteger(execution.total) ||
    Number(execution.completed) < 0 ||
    Number(execution.total) < Number(execution.completed) ||
    !(
      execution.policyReference === null ||
      typeof execution.policyReference === "string"
    ) ||
    !Array.isArray(execution.allocations)
  )
    throw new Error("Snapshot phân bổ Held chưa hợp lệ.");
  const allocations = execution.allocations.map((value) => {
    const allocation = record(value);
    if (
      !validId(allocation.allocationId) ||
      !validId(allocation.userId) ||
      typeof allocation.status !== "string" ||
      !Number.isInteger(allocation.lockedPathVersion) ||
      typeof allocation.remainingHeld !== "string"
    )
      throw new Error("Khoản Held chưa hợp lệ.");
    creditUnits(allocation.remainingHeld);
    return allocation as Allocation;
  });
  if (
    new Set(allocations.map((a) => a.allocationId)).size !== allocations.length
  )
    throw new Error("Khoản Held bị lặp trong snapshot.");
  return {
    ...row,
    execution: { ...execution, allocations } as TerminationReview["execution"],
  };
}
export function creditUnits(value: string): bigint {
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value))
    throw new Error("Credit phải là số không âm, tối đa 2 chữ số thập phân.");
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function sameExecution(a: TerminationReview, b: TerminationReview) {
  return (
    a.id === b.id &&
    a.pathId === b.pathId &&
    a.version === b.version &&
    a.execution.digest === b.execution.digest &&
    a.execution.policyReference === b.execution.policyReference &&
    a.blockedByDispute === b.blockedByDispute &&
    a.status === b.status
  );
}
export function terminationDecision(
  review: TerminationReview,
  reason: string,
  allocations: AllocationDecision[],
): TerminationDecision {
  if (
    review.kind !== "PATH_TERMINATION" ||
    !["ACCEPTED", "STAFF_REVIEW"].includes(review.status) ||
    review.blockedByDispute
  )
    throw new Error("Yêu cầu chưa thể thực thi hoặc đang có tranh chấp.");
  if (!review.execution.policyReference || review.awaitingPolicy)
    throw new Error("Chưa có chính sách dừng lộ trình được duyệt.");
  if (
    !/^[a-f0-9]{64}$/.test(review.execution.digest) ||
    !Number.isInteger(review.version) ||
    review.version < 1
  )
    throw new Error("Phiên bản xem xét không hợp lệ.");
  if (reason.trim().length < 3 || reason.trim().length > 1000)
    throw new Error("Lý do cần từ 3 đến 1.000 ký tự.");
  if (
    !allocations.length ||
    allocations.length > 2 ||
    allocations.length !== review.execution.allocations.length ||
    new Set(allocations.map((a) => a.allocationId)).size !== allocations.length
  )
    throw new Error("Cần phân bổ đúng một lần cho mọi khoản Held.");
  for (const a of allocations) {
    const held = review.execution.allocations.find(
      (item) => item.allocationId === a.allocationId,
    );
    if (
      !held ||
      creditUnits(a.refund) +
        creditUnits(a.counterpartyPayment) +
        creditUnits(a.platformFee) !==
        creditUnits(held.remainingHeld)
    )
      throw new Error(
        "Tổng hoàn + trả đối tác + phí phải bằng đúng Held còn lại của từng khoản.",
      );
  }
  return {
    expectedVersion: review.version,
    expectedExecutionDigest: review.execution.digest,
    policyReference: review.execution.policyReference,
    reason: reason.trim(),
    allocations: allocations.map((a) => ({ ...a })),
  };
}
