import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";

export const editablePath = (path: ApiLearningPath) =>
  path.lockedVersion === null &&
  ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);
export const agreementConfirmed = (path: ApiLearningPath) =>
  path.agreement.version === path.currentVersion &&
  !!path.agreement.participantAConfirmedAt &&
  !!path.agreement.participantBConfirmedAt;
export function canCreatePlan(path: ApiLearningPath, userId?: string) {
  if (!userId || ![path.participantAId, path.participantBId].includes(userId))
    return false;
  return (
    editablePath(path) &&
    agreementConfirmed(path) &&
    !path.plans.some((p) => p.teacherId === userId) &&
    (path.agreement.exchangeType === "TWO_WAY" ||
      path.agreement.teacherId === userId)
  );
}
export function canEditPlan(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    editablePath(path) &&
    agreementConfirmed(path) &&
    [path.participantAId, path.participantBId].includes(userId ?? "") &&
    plan.teacherId === userId
  );
}
export function canConfirmPlan(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    editablePath(path) &&
    agreementConfirmed(path) &&
    ["PROPOSED", "PARTIALLY_CONFIRMED"].includes(path.status) &&
    plan.learnerId === userId &&
    !plan.learnerConfirmedAt
  );
}
export function ownConfirmation(
  path: ApiLearningPath,
  value: {
    participantAConfirmedAt: string | null;
    participantBConfirmedAt: string | null;
  },
  userId?: string,
) {
  if (userId !== path.participantAId && userId !== path.participantBId)
    return null;
  return path.participantAId === userId
    ? value.participantAConfirmedAt
    : value.participantBConfirmedAt;
}
function schedulingReady(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    editablePath(path) &&
    path.status === "CONFIRMED" &&
    plansConfirmed(path) &&
    agreementConfirmed(path) &&
    [path.participantAId, path.participantBId].includes(userId ?? "") &&
    plan.status === "CONFIRMED" &&
    !!plan.learnerConfirmedAt
  );
}
export function scheduleIsComplete(plan: ApiLearningPlan) {
  const items = plan.schedule?.items;
  return (
    !!items &&
    items.length === plan.totalSessions &&
    new Set(items.map((item) => item.sessionNo)).size === plan.totalSessions &&
    items.every(
      (item) => item.sessionNo > 0 && item.sessionNo <= plan.totalSessions,
    )
  );
}
export function canSchedule(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    schedulingReady(path, plan, userId) &&
    plan.teacherId === userId &&
    !plan.schedule
  );
}
export function canEditSchedule(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    schedulingReady(path, plan, userId) &&
    plan.teacherId === userId &&
    !!plan.schedule &&
    plan.schedule.appliedVersion === null &&
    ["DRAFT", "PROPOSED", "PARTIALLY_CONFIRMED", "NEEDS_REVISION"].includes(
      plan.schedule.status,
    )
  );
}
export function canConfirmSchedule(
  path: ApiLearningPath,
  plan: ApiLearningPlan,
  userId?: string,
) {
  return (
    schedulingReady(path, plan, userId) &&
    !!plan.schedule &&
    scheduleIsComplete(plan) &&
    plan.schedule.appliedVersion === null &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "NEEDS_REVISION"].includes(
      plan.schedule.status,
    ) &&
    !ownConfirmation(path, plan.schedule, userId)
  );
}
export function canValidateForFinalize(path: ApiLearningPath) {
  if (
    !editablePath(path) ||
    path.status !== "CONFIRMED" ||
    !agreementConfirmed(path)
  )
    return false;
  return (
    plansConfirmed(path) &&
    path.plans.every(
      (p) =>
        !!p.schedule &&
        ["PROPOSED", "PARTIALLY_CONFIRMED"].includes(p.schedule.status) &&
        !!p.schedule.participantAConfirmedAt &&
        !!p.schedule.participantBConfirmedAt &&
        scheduleIsComplete(p),
    )
  );
}
export function plansConfirmed(path: ApiLearningPath) {
  const agreement = path.agreement;
  const directions =
    agreement.exchangeType === "TWO_WAY"
      ? path.plans.length === 2 &&
        path.plans.some(
          (p) =>
            p.teacherId === path.participantAId &&
            p.learnerId === path.participantBId,
        ) &&
        path.plans.some(
          (p) =>
            p.teacherId === path.participantBId &&
            p.learnerId === path.participantAId,
        )
      : path.plans.length === 1 &&
        path.plans[0]?.teacherId === agreement.teacherId &&
        path.plans[0]?.learnerId === agreement.learnerId;
  return (
    directions &&
    path.plans.every((p) => p.status === "CONFIRMED" && !!p.learnerConfirmedAt)
  );
}
export const scheduleStatusLabel: Record<
  NonNullable<ApiLearningPlan["schedule"]>["status"],
  string
> = {
  DRAFT: "Bản nháp",
  PROPOSED: "Đang thống nhất",
  PARTIALLY_CONFIRMED: "Chờ đủ xác nhận",
  LOCKED: "Đã khóa",
  NEEDS_REVISION: "Cần điều chỉnh",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
};
export const pathStatusLabel: Record<ApiLearningPath["status"], string> = {
  DRAFT: "Bản nháp",
  PROPOSED: "Đang thương lượng",
  PARTIALLY_CONFIRMED: "Đang xác nhận",
  CONFIRMED: "Đã xác nhận kế hoạch và điều khoản",
  SCHEDULED: "Đã chốt lịch",
  ACTIVE: "Đang học",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang tranh chấp",
};
export const learningSessionLabel: Record<
  ApiLearningPlan["sessions"][number]["status"],
  string
> = {
  CONFIRMED: "Đã xác nhận",
  READY: "Sắp bắt đầu",
  ONGOING: "Đang học",
  AWAITING_CONFIRMATION: "Chờ xác nhận hoàn thành",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang xem xét phản ánh",
};
