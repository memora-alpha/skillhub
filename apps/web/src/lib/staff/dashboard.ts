export type DashboardPeriod = {
  from: string;
  to: string;
  timezone: string;
  granularity: string;
};
type Bucket = { key: string; bucketStart: string; bucketEnd: string };
export type LearningActivity = Bucket & {
  pathsCreated: number;
  pathsSettled: number;
  sessionsScheduled: number;
  completedScheduledSessions: number;
};
export type FeePoint = Bucket & {
  collectedCredit: string;
  refundedCredit: string;
  netCredit: string;
};
export type DashboardData = {
  asOf: string;
  period: DashboardPeriod;
  kpis?: {
    newUsers?: number;
    pathsCreated?: number;
    pathsSettled?: number;
    sessionsScheduled?: number;
    completedScheduledSessions?: number;
    netFeeCredit?: string;
    paidOrders?: number;
    paidAmountVnd?: string;
    paidCreditAmount?: string;
  };
  userGrowth?: (Bucket & { newUsers: number })[];
  learningActivity?: LearningActivity[];
  pathStages?: { status: string; count: number }[];
  feeSeries?: FeePoint[];
  paymentSeries?: (Bucket & {
    paidOrders: number;
    paidAmountVnd: string;
    paidCreditAmount: string;
  })[];
  attentionSummary?: Record<string, number>;
};
export type DashboardSection<T> =
  | { availability: "AVAILABLE"; data: T }
  | { availability: "UNAVAILABLE"; errorCode: string };
export type DashboardSummary = {
  asOf: string;
  users: DashboardSection<{ totalUsers: number; newUsers: number }>;
  learning: DashboardSection<{
    activeLearningUsers: number;
    inProgressPaths: number;
    scheduledSessions: number;
    completedInScheduledCohort: number;
  }>;
  finance: DashboardSection<{ heldCredit: string }>;
  work: DashboardSection<{ payments: number }>;
  topSkills: DashboardSection<
    { skillId: string; name: string; completedSessions: number }[]
  >;
};
export type DashboardTrends = {
  asOf: string;
  from: string;
  to: string;
  timezone: string;
  granularity: "day";
  buckets: DashboardSection<
    {
      localDate: string;
      fromUtc: string;
      toUtc: string;
      partial: boolean;
      newUsers: number;
      scheduledSessions: number;
      completedSessions: number;
      topUpCredit: string;
    }[]
  >;
};
export function sectionData<T>(section?: DashboardSection<T>) {
  return section?.availability === "AVAILABLE" ? section.data : undefined;
}
export function dashboardWindowQuery(query: string) {
  const params = new URLSearchParams(query);
  params.delete("granularity");
  params.delete("sections");
  return params.toString();
}
/** Monetary chart buckets are decimal Credit, not floating point numbers. */
export function sumDashboardCredit(values?: string[]) {
  if (!values) return undefined;
  let total = 0n;
  for (const value of values) {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) return undefined;
    const units =
      BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
    total += match[1] ? -units : units;
  }
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export type WorkKind =
  | "PAYMENT_REVIEW"
  | "SETTLEMENT_REVIEW"
  | "REPORT_CASE"
  | "REPORT_INCIDENT"
  | "PATH_TERMINATION"
  | "SKILL_VERIFICATION"
  | "TAG_REQUEST";
export type AdminWorkItem = {
  id: string;
  kind: WorkKind;
  displayCode: string;
  title: string;
  severity: string;
  reason: string | null;
  status: string;
  waitingOn: string;
  assignee: string | null;
  receivedAt: string;
  waitingSince: string;
  ageSeconds: number;
  related: Record<string, string | null>;
};
export const workKinds: Record<WorkKind, string> = {
  PAYMENT_REVIEW: "Thanh toán cần đối soát",
  SETTLEMENT_REVIEW: "Quyết toán cần kiểm tra",
  REPORT_CASE: "Báo cáo",
  REPORT_INCIDENT: "Vụ việc đã gom",
  PATH_TERMINATION: "Yêu cầu dừng lộ trình",
  SKILL_VERIFICATION: "Xác minh kỹ năng",
  TAG_REQUEST: "Đề xuất tag",
};

/** The BE's openTarget uses API/domain routes, not the web route tree. */
export function workItemHref(
  item: Pick<AdminWorkItem, "kind" | "id" | "related">,
) {
  const id = encodeURIComponent(item.id);
  switch (item.kind) {
    case "PAYMENT_REVIEW":
      return `/admin/credits?tab=payments&paymentId=${id}`;
    case "SETTLEMENT_REVIEW":
      return `/admin/learning-paths/${id}`;
    case "REPORT_CASE":
      return `/admin/disputes/${id}`;
    case "REPORT_INCIDENT":
      return `/admin/disputes?incidentId=${id}`;
    case "PATH_TERMINATION":
      return (
        `/admin/learning-changes?requestId=${id}` +
        (item.related.pathId
          ? "&pathId=" + encodeURIComponent(item.related.pathId)
          : "")
      );
    case "SKILL_VERIFICATION":
      return `/admin/evidence?verificationId=${id}`;
    case "TAG_REQUEST":
      return `/admin/tag-requests?requestId=${id}`;
  }
}

export function localDate(now: Date, timezone = "Asia/Ho_Chi_Minh") {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: timezone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
/** Date inputs are inclusive local dates; the API upper boundary is exclusive. */
export function dashboardQuery(from: string, to: string, timezone: string) {
  if (!["UTC", "Asia/Ho_Chi_Minh"].includes(timezone))
    throw new Error("Múi giờ không được hỗ trợ.");
  for (const value of [from, to]) {
    const stamp = Date.parse(value + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number(value.slice(0, 4)) < 1 ||
      !Number.isFinite(stamp) ||
      new Date(stamp).toISOString().slice(0, 10) !== value
    )
      throw new Error("Chọn ngày bắt đầu và kết thúc hợp lệ.");
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days <= 0 || days > 366)
    throw new Error(
      "Ngày kết thúc phải từ ngày bắt đầu và trong tối đa 366 ngày.",
    );
  const offset = timezone === "UTC" ? "Z" : "+07:00";
  return new URLSearchParams({
    from: new Date(from + "T00:00:00" + offset).toISOString(),
    to: new Date(shiftDate(to, 1) + "T00:00:00" + offset).toISOString(),
    timezone,
    granularity: days > 62 ? "month" : "day",
  }).toString();
}
