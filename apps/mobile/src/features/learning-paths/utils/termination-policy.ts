import type { ApiLearningPath } from "../api/learning-paths-contract";
import type { TerminationRequest } from "../api/path-changes-contract";

export const openTermination = (row: TerminationRequest) =>
  ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(row.status);

export function canRequestTermination(
  path: ApiLearningPath,
  rows: TerminationRequest[],
) {
  return (
    path.lockedVersion !== null &&
    path.settledAt === null &&
    ["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status) &&
    !rows.some(openTermination)
  );
}
export function terminationActions(
  row: TerminationRequest,
  userId?: string,
  now = Date.now(),
) {
  const open =
    !!userId && openTermination(row) && now < Date.parse(row.expiresAt);
  return {
    respond: open && row.status === "PENDING" && row.requesterId !== userId,
    withdraw: open && row.requesterId === userId,
    escalate: open && row.status === "PENDING" && row.requesterId === userId,
  };
}
export const terminationLabels: Record<TerminationRequest["status"], string> = {
  PENDING: "Chờ đối tác phản hồi",
  ACCEPTED: "Hai bên đã đồng ý hủy",
  STAFF_REVIEW: "Chờ nhân viên xem xét",
  REJECTED: "Admin đã từ chối",
  WITHDRAWN: "Đã rút yêu cầu",
  EXPIRED: "Yêu cầu đã hết hạn",
  APPLIED: "Đã hủy lộ trình",
};
