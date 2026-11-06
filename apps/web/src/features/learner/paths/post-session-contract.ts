import { UserApiError } from "../api/client";

export type SettlementStatus = {
  pathId: string;
  status: string;
  reasonCode: string | null;
  nextAction: string;
  settledAt: string | null;
  lastCheckedAt: string | null;
  attemptCount: number;
  retryable: boolean;
  pathVersion: number | null;
  autoSettlementAt: string | null;
  immediateSettlement: {
    ownApprovedAt: string | null;
    partnerApprovedAt: string | null;
    canApprove: boolean;
  };
};
export function readSettlementStatus(
  value: unknown,
  pathId: string,
): SettlementStatus {
  const v = value as SettlementStatus | null;
  if (
    v?.pathId !== pathId ||
    typeof v.status !== "string" ||
    typeof v.retryable !== "boolean" ||
    !v.immediateSettlement ||
    typeof v.immediateSettlement.canApprove !== "boolean" ||
    (v.pathVersion !== null &&
      (!Number.isSafeInteger(v.pathVersion) || v.pathVersion < 1))
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return v;
}
export function readConsentReceipt(value: unknown, pathId: string) {
  const v = value as {
    pathId: string;
    approvedAt: string;
    bothApproved: boolean;
    settlement: { outcome: string };
  } | null;
  if (
    v?.pathId !== pathId ||
    typeof v.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(v.approvedAt)) ||
    typeof v.bothApproved !== "boolean" ||
    !["SETTLED", "WAITING", "RETRYING", "NEEDS_REVIEW"].includes(
      v.settlement?.outcome,
    )
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return v;
}
export const settlementStatusLabels: Record<string, string> = {
  SETTLED: "Đã giải ngân",
  TERMINATED: "Thỏa thuận đã dừng",
  NOT_LOCKED: "Chưa chốt thỏa thuận",
  WAITING_SESSIONS: "Chờ hoàn thành các buổi học",
  WAITING_TERMINATION: "Đang xử lý yêu cầu dừng",
  WAITING_DISPUTE: "Chờ xử lý tranh chấp",
  WAITING_DISPUTE_WINDOW: "Đang trong thời hạn khiếu nại",
  NEEDS_REVIEW: "Cần nhân sự kiểm tra",
  RETRYING: "Hệ thống đang thử giải ngân lại",
  READY: "Hệ thống đang kiểm tra giải ngân",
};
export type LearningChange = {
  id: string;
  pathId: string;
  sessionId: string | null;
  kind: "SESSION_CANCELLATION" | "PATH_TERMINATION";
  status: string;
  version: number;
  requesterId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  occurrenceStartAt: string | null;
  responseNote: string | null;
  blockedByDispute: boolean;
  awaitingPolicy: boolean;
  resolution: { outcome?: string; creditPenalty?: string } | null;
};
export const changeLabels: Record<string, string> = {
  PENDING: "Chờ đối tác phản hồi",
  ACCEPTED: "Hai bên đã đồng ý, chờ xử lý",
  STAFF_REVIEW: "Đang chuyển nhân sự xử lý",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
  APPLIED: "Đã áp dụng",
};
export function canRequestCancellation(
  session: {
    status: string;
    startAt: string;
    makeupCount?: number;
    makeupQuota?: { remaining: number; requiresReview: boolean };
  },
  now: number,
) {
  return (
    ["CONFIRMED", "READY"].includes(session.status) &&
    Date.parse(session.startAt) > now &&
    (session.makeupCount ?? 0) < 1 &&
    (!session.makeupQuota ||
      (!session.makeupQuota.requiresReview &&
        session.makeupQuota.remaining > 0))
  );
}
export type PathReview = {
  id: string;
  pathId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};
export function checkedReviews(
  value: unknown,
  pathId: string,
  participants: string[],
): PathReview[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (r: PathReview) =>
        !r ||
        typeof r.id !== "string" ||
        r.pathId !== pathId ||
        !participants.includes(r.reviewerId) ||
        !participants.includes(r.revieweeId) ||
        r.reviewerId === r.revieweeId ||
        !Number.isInteger(r.rating) ||
        r.rating < 1 ||
        r.rating > 5 ||
        (r.comment !== null && typeof r.comment !== "string"),
    )
  )
    throw new UserApiError(502, "API_RESPONSE_INVALID");
  return value;
}
