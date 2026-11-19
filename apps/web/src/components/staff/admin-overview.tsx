"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/console/icon";
import {
  dashboardQuery,
  dashboardWindowQuery,
  localDate,
  shiftDate,
  sectionData,
  sumDashboardCredit,
  type DashboardData,
  type DashboardSummary,
  type DashboardTrends,
} from "@/lib/staff/dashboard";
import {
  DashboardRefreshProvider,
  useDashboardRefresh,
  useDashboardResource,
} from "./dashboard-data";
import { DashboardChart } from "./dashboard-chart";
import { DashboardWork } from "./dashboard-work";
import {
  DashboardMetric,
  dashboardMoney,
  dashboardNumber,
  TopSkills,
  PathStages,
  Attention,
  SessionDistribution,
  PathsToWatch,
  RecentPayments,
  useWorkCount,
} from "./dashboard-widgets";
import styles from "./dashboard.module.css";

const green = "var(--brand)",
  blue = "var(--info)",
  amber = "var(--warn)";
const tabs = [
  { id: "overview", label: "Tổng quan" },
  { id: "learning", label: "Học tập" },
  { id: "finance", label: "Credit & thanh toán" },
];
type Range = { from: string; to: string; timezone: string };
type DataProps = {
  summary?: DashboardSummary;
  data?: DashboardData;
  finance?: DashboardData;
  trends?: DashboardTrends;
  loading: boolean;
};

export function AdminOverviewScreen() {
  return (
    <DashboardRefreshProvider>
      <DashboardScreen />
    </DashboardRefreshProvider>
  );
}
function DashboardScreen() {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState<Range>(() => {
    const today = localDate(new Date());
    return {
      from: shiftDate(today, -6),
      to: today,
      timezone: "Asia/Ho_Chi_Minh",
    };
  });
  const [draft, setDraft] = useState(range);
  const [preset, setPreset] = useState<number | "custom">(7);
  const [error, setError] = useState("");
  const [workFilter, setWorkFilter] = useState("");
  const { refresh } = useDashboardRefresh();
  const query = dashboardQuery(range.from, range.to, range.timezone);
  const summary = useDashboardResource<DashboardSummary>(
    `dashboard/summary?${dashboardWindowQuery(query)}`,
  );
  const charts = useDashboardResource<DashboardData>(
    `dashboard/overview?${query}&sections=userGrowth,learningActivity,pathStages`,
  );
  const finance = useDashboardResource<DashboardData>(
    `dashboard/finance?${query}`,
  );
  const trends = useDashboardResource<DashboardTrends>(
    `dashboard/trends?${query}`,
  );
  const loading =
    summary.loading || charts.loading || finance.loading || trends.loading;
  const dates = [
    summary.data?.asOf,
    charts.data?.asOf,
    finance.data?.asOf,
    trends.data?.asOf,
  ].filter(
    (value): value is string => !!value && Number.isFinite(Date.parse(value)),
  );
  const asOf = dates.length
    ? new Date(Math.min(...dates.map(Date.parse)))
    : undefined;
  const updateLabel = asOf
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: range.timezone,
        dateStyle: "short",
        timeStyle: "short",
      }).format(asOf)
    : "Chưa có thời điểm cập nhật";
  const resources = [
    { label: "Tổng hợp", ...summary },
    { label: "Biểu đồ", ...charts },
    { label: "Tài chính", ...finance },
    { label: "Xu hướng theo ngày", ...trends },
  ];
  const selectPreset = (days: number) => {
    const today = localDate(new Date(), range.timezone);
    const next = { ...range, from: shiftDate(today, 1 - days), to: today };
    if (dashboardQuery(next.from, next.to, next.timezone) === query) refresh();
    setRange(next);
    setDraft(next);
    setPreset(days);
    setError("");
  };
  const openWork = (filter: string) => {
    setWorkFilter(filter);
    document
      .getElementById("priority-list")
      ?.scrollIntoView({ behavior: "auto", block: "start" });
  };
  const props: DataProps = {
    summary: summary.data,
    data: charts.data,
    finance: finance.data,
    trends: trends.data,
    loading,
  };
  return (
    <div className={styles.dashboard}>
      <title>Tổng quan hệ thống · SkillHub</title>
      <header className={styles.header}>
        <div>
          <h1>Tổng quan hệ thống</h1>
          <p>
            Theo dõi tăng trưởng, hoạt động học tập và Credit trên SkillHub.
          </p>
        </div>
        <span className={styles.updated}>
          {!loading && <i />}
          {loading ? (
            <LoadingSkeleton variant="inline" label="Đang làm mới số liệu" />
          ) : (
            `Cập nhật ${updateLabel}`
          )}{" "}
          · {range.timezone === "UTC" ? "UTC" : "GMT+7"}
        </span>
      </header>
      <form
        className={styles.toolbar}
        aria-label="Bộ lọc thời gian"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const next = dashboardQuery(draft.from, draft.to, draft.timezone);
            if (next === query) refresh();
            setRange(draft);
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Kiểm tra lại khoảng ngày.",
            );
          }
        }}
      >
        <fieldset className={styles.presets} aria-label="Khoảng thời gian">
          {[
            [1, "Hôm nay"],
            [7, "7 ngày qua"],
            [30, "30 ngày qua"],
          ].map(([days, label]) => (
            <button
              key={days}
              type="button"
              aria-pressed={preset === days}
              onClick={() => selectPreset(Number(days))}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className={styles.control}
          aria-pressed={preset === "custom"}
          onClick={() => setPreset("custom")}
        >
          <Icon name="calendar" size={16} />
          Tùy chọn ngày
        </button>
        {preset === "custom" && (
          <div className={styles.dateRange}>
            <label>
              <span>Từ ngày</span>
              <input
                type="date"
                required
                value={draft.from}
                max={draft.to || undefined}
                onChange={(event) =>
                  setDraft({ ...draft, from: event.target.value })
                }
              />
            </label>
            <span>–</span>
            <label>
              <span>Đến ngày</span>
              <input
                type="date"
                required
                min={draft.from}
                value={draft.to}
                onChange={(event) =>
                  setDraft({ ...draft, to: event.target.value })
                }
              />
            </label>
          </div>
        )}
        <label className={styles.timezone}>
          <span className="sr-only">Múi giờ</span>
          <select
            value={draft.timezone}
            onChange={(event) => {
              const next = { ...range, timezone: event.target.value };
              setRange(next);
              setDraft({ ...draft, timezone: event.target.value });
            }}
          >
            <option value="Asia/Ho_Chi_Minh">GMT+7 · Việt Nam</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
        <LoadingButton
          className={`btn btn-primary ${styles.refresh}`}
          type="submit"
          disabled={loading}
          loading={!!loading}
        >
          <Icon name="refresh" size={16} />
          {loading ? "Đang tải…" : "Làm mới"}
        </LoadingButton>
      </form>
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      <fieldset className={styles.tabRow} aria-label="Nội dung thống kê">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      {resources
        .filter((resource) => resource.error)
        .map((resource) => (
          <p key={resource.label} role="alert" className={styles.notice}>
            {resource.label}: {resource.error}{" "}
            {resource.data && "Đang hiển thị dữ liệu đã tải trước đó."}
          </p>
        ))}
      <section
        className={styles.tabContent}
        aria-label={tabs.find((item) => item.id === tab)?.label}
        aria-busy={loading}
      >
        {tab === "overview" && (
          <>
            <OverviewDashboard
              {...props}
              onWorkFilter={openWork}
              onTab={setTab}
            />
            <DashboardWork key={workFilter} filter={workFilter} />
          </>
        )}
        {tab === "learning" && <LearningDashboard {...props} />}
        {tab === "finance" && <FinanceDashboard {...props} query={query} />}
      </section>
    </div>
  );
}
function OverviewDashboard({
  summary,
  data,
  finance,
  trends,
  loading,
  onWorkFilter,
  onTab,
}: Readonly<
  DataProps & {
    onWorkFilter: (filter: string) => void;
    onTab: (tab: string) => void;
  }
>) {
  const users = sectionData(summary?.users),
    learning = sectionData(summary?.learning);
  const k = finance?.kpis;
  return (
    <>
      <div className={`${styles.metrics} ${styles.overviewMetrics}`}>
        <DashboardMetric
          label="Tổng người dùng"
          value={dashboardNumber(users?.totalUsers)}
          hint={`${dashboardNumber(users?.newUsers)} người mới trong kỳ`}
          icon="users"
          action={<Link href="/admin/users">Xem danh sách →</Link>}
        />
        <DashboardMetric
          label="Người dùng hoạt động"
          value={dashboardNumber(learning?.activeLearningUsers)}
          hint="Có hoạt động học tập trong kỳ"
          icon="book"
          action={
            <button type="button" onClick={() => onTab("learning")}>
              Xem hoạt động →
            </button>
          }
        />
        <DashboardMetric
          label="Lộ trình đang học"
          value={dashboardNumber(learning?.inProgressPaths)}
          hint="Hiện tại · Một thỏa thuận tính một lộ trình"
          icon="file"
          action={<Link href="/admin/learning-paths">Xem danh sách →</Link>}
        />
        <DashboardMetric
          label="Buổi học hoàn thành"
          value={dashboardNumber(learning?.completedInScheduledCohort)}
          hint={`Trong ${dashboardNumber(learning?.scheduledSessions)} buổi có lịch trong kỳ`}
          icon="check"
          action={
            <button type="button" onClick={() => onTab("learning")}>
              Xem buổi học →
            </button>
          }
        />
        <DashboardMetric
          label="Nạp thành công"
          value={dashboardMoney(k?.paidAmountVnd, "₫")}
          hint={`${dashboardNumber(k?.paidOrders)} giao dịch được ghi nhận`}
          action={
            <button type="button" onClick={() => onTab("finance")}>
              Xem danh sách →
            </button>
          }
        />
        <DashboardMetric
          label="Phí nền tảng thuần"
          value={dashboardMoney(k?.netFeeCredit)}
          hint="Phí thu trừ phí hoàn trong kỳ"
          action={<Link href="/admin/credits?tab=fees">Xem chi tiết →</Link>}
        />
      </div>
      <div className={styles.grid}>
        <DashboardChart
          title="Người dùng mới"
          description="Tài khoản được tạo trong kỳ đã chọn."
          total={dashboardNumber(users?.newUsers)}
          totalLabel="người dùng mới"
          available={trends?.buckets.availability === "AVAILABLE"}
          loading={loading}
          points={(sectionData(trends?.buckets) ?? []).map((row) => ({
            label: row.localDate,
            values: { newUsers: row.newUsers },
          }))}
          series={[{ key: "newUsers", label: "Người dùng mới", color: green }]}
        />
        <LearningActivity trends={trends} summary={summary} loading={loading} />
        <PathStages data={data} loading={loading} />
        <FeeChart data={finance} loading={loading} />
        <TopSkills summary={summary} loading={loading} />
        <Attention summary={summary} onFilter={onWorkFilter} />
      </div>
    </>
  );
}
function LearningActivity({
  trends,
  summary,
  loading,
  detail = false,
}: Readonly<
  Pick<DataProps, "trends" | "summary" | "loading"> & { detail?: boolean }
>) {
  return (
    <DashboardChart
      title={detail ? "Buổi học theo lịch" : "Hoạt động học tập"}
      description="Theo lịch trong kỳ, đánh giá tại thời điểm cập nhật."
      total={dashboardNumber(sectionData(summary?.learning)?.scheduledSessions)}
      totalLabel="buổi có lịch"
      available={trends?.buckets.availability === "AVAILABLE"}
      loading={loading}
      bars
      points={(sectionData(trends?.buckets) ?? []).map((row) => ({
        label: row.localDate,
        values: {
          scheduled: row.scheduledSessions,
          completed: row.completedSessions,
        },
      }))}
      series={[
        { key: "scheduled", label: "Có lịch", color: green },
        { key: "completed", label: "Đã hoàn thành", color: "var(--info)" },
      ]}
    />
  );
}
function LearningDashboard({ summary, trends, loading }: Readonly<DataProps>) {
  const learning = sectionData(summary?.learning);
  const scheduled = learning?.scheduledSessions ?? 0;
  const completed = learning?.completedInScheduledCohort ?? 0;
  const completionRate =
    learning && scheduled > 0
      ? `${Math.round((completed / scheduled) * 100)}%`
      : "—";
  return (
    <>
      <div className={`${styles.metrics} ${styles.learningMetrics}`}>
        <DashboardMetric
          label="Lộ trình đang học"
          value={dashboardNumber(learning?.inProgressPaths)}
          hint="Hiện tại · Một thỏa thuận tính một lộ trình"
          icon="book"
        />
        <DashboardMetric
          label="Tỷ lệ hoàn thành buổi học"
          value={completionRate}
          hint={
            scheduled > 0
              ? `${dashboardNumber(completed)}/${dashboardNumber(scheduled)} buổi có lịch trong kỳ`
              : "Chưa có buổi học theo lịch trong kỳ"
          }
          icon="check"
        />
        <DashboardMetric
          label="Buổi có lịch trong kỳ"
          value={dashboardNumber(learning?.scheduledSessions)}
          hint="Theo kỳ đã chọn"
          icon="calendar"
        />
        <DashboardMetric
          label="Đã hoàn thành trong nhóm"
          value={dashboardNumber(learning?.completedInScheduledCohort)}
          hint="Trong nhóm buổi có lịch của kỳ"
          icon="check"
        />
      </div>
      <div className={`${styles.grid} ${styles.learningGrid}`}>
        <LearningActivity
          trends={trends}
          summary={summary}
          loading={loading}
          detail
        />
        <SessionDistribution
          completed={learning?.completedInScheduledCohort}
          scheduled={learning?.scheduledSessions}
        />
      </div>
      <PathsToWatch />
    </>
  );
}
function FeeChart({
  data,
  loading,
  detail = false,
}: Readonly<{ data?: DashboardData; loading: boolean; detail?: boolean }>) {
  const collected = sumDashboardCredit(
    data?.feeSeries?.map((row) => row.collectedCredit),
  );
  const refunded = sumDashboardCredit(
    data?.feeSeries?.map((row) => row.refundedCredit),
  );
  const series = [
    { key: "collectedCredit", label: "Phí thu", color: green },
    { key: "refundedCredit", label: "Phí hoàn", color: amber },
  ];
  if (!detail)
    series.push({ key: "netCredit", label: "Phí thuần", color: blue });
  return (
    <DashboardChart
      title={detail ? "Phí nền tảng theo kỳ" : "Phí nền tảng"}
      description="Phí thu, phí hoàn và phí thuần bằng Credit trong kỳ."
      total={dashboardMoney(data?.kpis?.netFeeCredit)}
      totalLabel="phí thuần"
      bars
      unit="CR"
      available={!!data}
      loading={loading}
      points={(data?.feeSeries ?? []).map((row) => ({
        label: row.key,
        values: {
          collectedCredit: row.collectedCredit,
          refundedCredit: row.refundedCredit,
          netCredit: row.netCredit,
        },
      }))}
      series={series}
      footer={
        <>
          <span>
            Thu <strong>{dashboardMoney(collected)}</strong>
          </span>
          <span>
            Hoàn <strong>{dashboardMoney(refunded)}</strong>
          </span>
          <span>
            Thuần <strong>{dashboardMoney(data?.kpis?.netFeeCredit)}</strong>
          </span>
          <Link className={styles.textLink} href="/admin/credits?tab=fees">
            Xem báo cáo phí →
          </Link>
        </>
      }
    />
  );
}
function FinanceDashboard({
  summary,
  finance,
  loading,
  query,
}: Readonly<DataProps & { query: string }>) {
  const k = finance?.kpis;
  const settlement = useWorkCount("kind=SETTLEMENT_REVIEW");
  const collected = sumDashboardCredit(
    finance?.feeSeries?.map((row) => row.collectedCredit),
  );
  const refunded = sumDashboardCredit(
    finance?.feeSeries?.map((row) => row.refundedCredit),
  );
  return (
    <>
      <div className={styles.financeGroup}>
        <h2 className={styles.groupLabel}>TRONG KỲ</h2>
        <div className={`${styles.metrics} ${styles.financeMetrics}`}>
          <DashboardMetric
            label="Nạp thành công"
            value={dashboardMoney(k?.paidAmountVnd, "₫")}
            hint="Giá trị thanh toán VND"
          />
          <DashboardMetric
            label="Giao dịch thành công"
            value={dashboardNumber(k?.paidOrders)}
            hint="Đã được hệ thống ghi nhận"
            icon="check"
          />
          <DashboardMetric
            label="Credit đã ghi nhận"
            value={dashboardMoney(k?.paidCreditAmount)}
            hint="Tương ứng giao dịch thành công"
          />
        </div>
      </div>
      <div className={styles.financeGroup}>
        <h2 className={styles.groupLabel}>HIỆN TẠI</h2>
        <div className={`${styles.metrics} ${styles.financeMetrics}`}>
          <DashboardMetric
            label="Credit đang giữ"
            value={dashboardMoney(sectionData(summary?.finance)?.heldCredit)}
            hint="Số dư đang giữ hiện tại"
          />
          <DashboardMetric
            label="Thanh toán cần rà soát"
            value={dashboardNumber(finance?.attentionSummary?.paymentsInReview)}
            hint="Hiện tại trên toàn hệ thống"
            icon="alert"
          />
          <DashboardMetric
            label="Quyết toán cần rà soát"
            value={settlement.label}
            hint="Dấu + nghĩa là còn việc chưa hiển thị"
            icon="alert"
          />
        </div>
      </div>
      <div className={styles.financeGroup}>
        <h2 className={styles.groupLabel}>PHÍ TRONG KỲ · CREDIT</h2>
        <div
          className={`${styles.metrics} ${styles.financeMetrics} ${styles.feeMetrics}`}
        >
          <DashboardMetric
            label="Phí thu"
            value={dashboardMoney(collected)}
            hint="Trong kỳ đã chọn"
          />
          <DashboardMetric
            label="Phí hoàn"
            value={dashboardMoney(refunded)}
            hint="Trong kỳ đã chọn"
          />
          <DashboardMetric
            label="Phí thuần"
            value={dashboardMoney(k?.netFeeCredit)}
            hint="Phí thu trừ phí hoàn"
          />
        </div>
      </div>
      <FeeChart data={finance} loading={loading} detail />
      <RecentPayments query={query} />
    </>
  );
}
