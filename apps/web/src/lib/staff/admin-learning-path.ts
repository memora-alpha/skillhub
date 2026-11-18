import { financeNumber } from "./finance-presentation";

export type PathPerson = { id: string; fullName: string };
export type PathPlan = {
  planId: string;
  planVersion: number;
  planVersionRecord: {
    skillId: string;
    learningGoal: string;
    totalSessions: number;
    skillIdRecord: { name: string };
  };
};
export type PathVersion = {
  versionNo: number;
  exchangeType: string;
  totalCreditPerUser: string | null;
  negotiatedCredit: string | null;
  createdAt: string;
  pathVersionPlanPathVersionRecords: PathPlan[];
};
export type PathAttendance = {
  status: string;
  attendanceCase: string;
  resolution: string | null;
  occurrenceStartAt: string;
};
export type PathSession = {
  id: string;
  planId: string;
  planVersion: number;
  outlineSessionNo: number;
  teacherId: string;
  learnerId: string;
  startAt: string;
  endAt: string;
  status: string;
  teacherFirstJoinedAt: string | null;
  learnerFirstJoinedAt: string | null;
  teacherAttendanceSeconds: string;
  learnerAttendanceSeconds: string;
  attendanceOutcomes: PathAttendance[];
};
export type AdminPathDetail = {
  id: string;
  status: string;
  currentVersion: number;
  lockedVersion: number | null;
  participants: PathPerson[];
  versions: PathVersion[];
  sessions: PathSession[];
  settlement: {
    settledPathVersion: number | null;
    exchangeType: string | null;
    grossCredit: string | null;
    feeCredit: string | null;
    settledAt: string | null;
    attempt: {
      checkedAt: string;
      attemptCount: number;
      outcome: string;
      errorCode: string | null;
    } | null;
  };
  reports: {
    id: string;
    status: string;
    severity: string | null;
    reasonCode: string;
    createdAt: string | null;
  }[];
  terminations: {
    id: string;
    status: string;
    version: number;
    createdAt: string;
    closedAt: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** This Admin reader returns integer units, one hundredth of a Credit. */
export function adminPathCredit(units: string | null) {
  if (units === null || !/^-?\d+$/.test(units)) return "—";
  const value = BigInt(units),
    absolute = value < 0n ? -value : value;
  return (
    financeNumber(
      `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
    ) + " CR"
  );
}

export function attendanceDuration(seconds: string) {
  if (!/^\d+$/.test(seconds)) return "Chưa có dữ liệu";
  const value = BigInt(seconds);
  if (value === 0n) return "0 giây ghi nhận";
  const parts = [
    [value / 3600n, "giờ"],
    [(value % 3600n) / 60n, "phút"],
    [value % 60n, "giây"],
  ] as const;
  return parts
    .filter(([amount]) => amount > 0n)
    .map(([amount, label]) => `${amount.toLocaleString("vi-VN")} ${label}`)
    .join(" ");
}

export function activePathVersion(path: AdminPathDetail) {
  return path.versions.find(
    (version) =>
      version.versionNo === (path.lockedVersion ?? path.currentVersion),
  );
}

export function sessionPlan(path: AdminPathDetail, session: PathSession) {
  return path.versions
    .flatMap((version) => version.pathVersionPlanPathVersionRecords)
    .find(
      (plan) =>
        plan.planId === session.planId &&
        plan.planVersion === session.planVersion,
    );
}

export function occurrenceAttendance(session: PathSession) {
  const stamp = Date.parse(session.startAt);
  return session.attendanceOutcomes.find(
    (outcome) =>
      Number.isFinite(stamp) && Date.parse(outcome.occurrenceStartAt) === stamp,
  );
}

export const sessionStatusLabels: Record<string, string> = {
  CONFIRMED: "Đã xác nhận",
  READY: "Sẵn sàng",
  ONGOING: "Đang diễn ra",
  AWAITING_CONFIRMATION: "Chờ xác nhận kết quả",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  DISPUTED: "Đang tranh chấp",
  NO_SHOW: "Có người vắng học",
  MAKEUP_REQUIRED: "Cần học bù",
};
const attendanceLabels: Record<string, string> = {
  BOTH_PRESENT: "Cả hai tham gia",
  TEACHER_ABSENT: "Người dạy vắng",
  LEARNER_ABSENT: "Người học vắng",
  BOTH_ABSENT: "Cả hai vắng",
  UNVERIFIABLE: "Chưa xác minh được",
  PROVISIONAL: "Kết quả tạm thời",
  FINAL: "Đã chốt",
  EXCUSED: "Được chấp nhận lý do",
  DISPUTED: "Đang tranh chấp",
  OVERTURNED: "Kết quả đã được thay đổi",
  COMPLETED_MUTUAL: "Hoàn tất theo xác nhận hai bên",
  COMPLETED_TIMEOUT: "Hoàn tất sau thời hạn xác nhận",
  COMPLETED_LEARNER_NO_SHOW: "Hoàn tất theo xử lý người học vắng",
  COMPLETED_STAFF: "Hoàn tất theo xử lý vận hành",
  MAKEUP_REQUIRED: "Cần học bù",
  STAFF_REVIEW: "Cần vận hành xem xét",
};
export function attendanceLabel(code: string | null) {
  return code && Object.hasOwn(attendanceLabels, code)
    ? attendanceLabels[code]!
    : "Chưa có kết luận";
}
export function exchangeLabel(code?: string | null) {
  return code === "ONE_WAY"
    ? "Một chiều"
    : code === "TWO_WAY"
      ? "Hai chiều"
      : "Chưa xác định";
}

export function settlementAttemptText(
  attempt: NonNullable<AdminPathDetail["settlement"]["attempt"]>,
) {
  const reasons: Record<string, string> = {
    LEARNING_PATH_NOT_SETTLEABLE: "Lộ trình chưa đủ điều kiện quyết toán",
    PATH_SESSIONS_INCOMPLETE: "Đang chờ các buổi học hoàn tất",
    SETTLEMENT_BLOCKED_BY_DISPUTE: "Đang chờ xử lý vụ việc chặn quyết toán",
    DISPUTE_WINDOW_OPEN: "Đang trong thời hạn tiếp nhận khiếu nại",
    SETTLEMENT_BLOCKED_BY_TERMINATION: "Đang chờ xử lý yêu cầu dừng lộ trình",
    SETTLEMENT_TEMPORARILY_UNAVAILABLE:
      "Chưa thể hoàn tất quyết toán; hệ thống sẽ kiểm tra lại",
  };
  if (attempt.errorCode && Object.hasOwn(reasons, attempt.errorCode))
    return reasons[attempt.errorCode]!;
  const outcomes: Record<string, string> = {
    WAITING: "Đang chờ đủ điều kiện quyết toán",
    NEEDS_REVIEW: "Cần đối soát điều kiện quyết toán",
    RETRYING: "Hệ thống đang chờ kiểm tra lại quyết toán",
    SETTLED: "Đã ghi nhận quyết toán trong lần kiểm tra này",
    TERMINATED: "Lộ trình đã dừng; kiểm tra giao dịch để đối chiếu Credit",
  };
  return Object.hasOwn(outcomes, attempt.outcome)
    ? outcomes[attempt.outcome]!
    : "Đã ghi nhận lần kiểm tra điều kiện quyết toán";
}
