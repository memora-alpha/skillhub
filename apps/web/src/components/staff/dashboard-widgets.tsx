"use client";
import Link from "next/link";
import { UserProfileReference } from "./user-profile-reference";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/console/icon";
import { Empty, StatusBadge } from "@/components/console/ui";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { fmtDateTime, fmtNum } from "@/lib/console/format";
import { financeNumber } from "@/lib/staff/finance-presentation";
import {
  sectionData,
  type DashboardData,
  type DashboardSummary,
} from "@/lib/staff/dashboard";
import { systemCodeLabel } from "@/lib/system-text";
import { QueueState } from "./common";
import { useDashboardList, useDashboardResource } from "./dashboard-data";
import styles from "./dashboard.module.css";

export const dashboardNumber = (value?: number) =>
  value === undefined ? "—" : fmtNum(value);
export const dashboardMoney = (value?: string, suffix = "CR") =>
  value === undefined ? "—" : `${financeNumber(value)} ${suffix}`;
export function DashboardPanel({
  title,
  description,
  total,
  totalLabel,
  actions,
  footer,
  children,
  className = "",
}: Readonly<{
  title: string;
  description?: string;
  total?: string;
  totalLabel?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`${styles.widget} ${className}`}>
      <header className={styles.widgetHead}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {total !== undefined && (
          <div className={styles.chartTotal}>
            <strong>{total}</strong>
            <span>{totalLabel}</span>
          </div>
        )}
        {actions}
      </header>
      <div className={styles.widgetBody}>{children}</div>
      {footer && <footer className={styles.widgetFooter}>{footer}</footer>}
    </section>
  );
}
export function DashboardMetric({
  label,
  value,
  hint,
  icon = "card",
  action,
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  icon?: IconName;
  action?: ReactNode;
}>) {
  return (
    <article className={styles.metric}>
      <div className={styles.metricLabel}>
        <span>
          <i className={styles.metricIcon}>
            <Icon name={icon} size={16} />
          </i>
          {label}
        </span>
        <span title={hint} aria-label={hint}>
          ⓘ
        </span>
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      <div className={styles.metricFooter}>
        <span>{hint}</span>
        {action}
      </div>
    </article>
  );
}
export function DashboardPerson({ id }: Readonly<{ id: string }>) {
  const profile = useDashboardResource<{ fullName: string }>(`profiles/${id}`);
  return (
    <UserProfileReference userId={id}>
      {profile.data?.fullName || `Thành viên #${id.slice(0, 8)}`}
    </UserProfileReference>
  );
}
export function PathStages({
  data,
  loading,
}: Readonly<{ data?: DashboardData; loading: boolean }>) {
  const rows = data?.pathStages ?? [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const emptyPathDistribution = loading ? (
    <LoadingSkeleton label="Đang tải số liệu lộ trình" />
  ) : (
    <Empty title="Chưa có số liệu lộ trình" />
  );
  return (
    <DashboardPanel
      title="Tình hình lộ trình"
      description="Trạng thái hiện tại của các lộ trình được tạo trong kỳ."
      total={data ? fmtNum(total) : "—"}
      totalLabel="lộ trình"
      footer="Học xong chưa đồng nghĩa với đã quyết toán."
    >
      {rows.length ? (
        <div className={styles.horizontalBars}>
          {rows.map((row) => (
            <Link
              key={row.status}
              href={`/admin/learning-paths?status=${row.status}`}
              className={styles.horizontalRow}
            >
              <span>{systemCodeLabel(row.status, "Trạng thái khác")}</span>
              <span className={styles.track}>
                <span style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <strong>{fmtNum(row.count)}</strong>
            </Link>
          ))}
        </div>
      ) : (
        emptyPathDistribution
      )}
    </DashboardPanel>
  );
}
export function TopSkills({
  summary,
  loading,
}: Readonly<{ summary?: DashboardSummary; loading: boolean }>) {
  const rows = sectionData(summary?.topSkills)?.slice(0, 5);
  const max = Math.max(1, ...(rows ?? []).map((row) => row.completedSessions));
  const highest = rows?.[0]?.completedSessions;
  const emptySkillRanking = loading ? (
    <LoadingSkeleton label="Đang tải số liệu kỹ năng" />
  ) : (
    <Empty title="Chưa có số liệu kỹ năng" />
  );
  return (
    <DashboardPanel
      title="Kỹ năng được học nhiều nhất"
      description="Tính theo số buổi hoàn thành trong nhóm lịch đã chọn."
      total={dashboardNumber(highest)}
      totalLabel="buổi cao nhất"
    >
      {rows?.length ? (
        <ol className={styles.skillBars}>
          {rows.map((row, index) => (
            <li key={row.skillId}>
              <span className={styles.skillRank}>{index + 1}</span>
              <strong>{row.name}</strong>
              <span className={styles.track}>
                <span
                  style={{ width: `${(row.completedSessions / max) * 100}%` }}
                />
              </span>
              <span>{fmtNum(row.completedSessions)}</span>
            </li>
          ))}
        </ol>
      ) : (
        emptySkillRanking
      )}
    </DashboardPanel>
  );
}
export function useWorkCount(query: string) {
  const resource = useDashboardResource<{ id: string }[]>(
    `dashboard/work-items?limit=1&${query}`,
  );
  let label = "—";
  if (resource.data)
    label = `${resource.data.length}${resource.pagination?.hasMore ? "+" : ""}`;
  return { ...resource, label };
}
export function Attention({
  summary,
  onFilter,
}: Readonly<{
  summary?: DashboardSummary;
  onFilter: (filter: string) => void;
}>) {
  return (
    <DashboardPanel
      title="Cần chú ý"
      description="Các ngoại lệ cần Admin theo dõi hoặc can thiệp."
      actions={<span className={styles.scopePill}>Hiện tại</span>}
      footer="Chờ trên 24 giờ là tuổi công việc, chưa phải SLA."
    >
      <div className={styles.attention}>
        <AttentionRow
          label="Thanh toán cần rà soát"
          value={dashboardNumber(sectionData(summary?.work)?.payments)}
          hint="Thanh toán"
          onClick={() => onFilter("PAYMENT_REVIEW")}
        />
        <AttentionCount
          label="Quyết toán cần kiểm tra"
          hint="Quyết toán"
          query="kind=SETTLEMENT_REVIEW"
          onClick={() => onFilter("SETTLEMENT_REVIEW")}
        />
        <AttentionCount
          label="Vụ việc khẩn cấp"
          hint="Khẩn cấp"
          query="severity=CRITICAL"
          onClick={() => onFilter("CRITICAL")}
        />
        <AttentionCount
          label="Chưa có người xử lý"
          hint="Cần phân công"
          query="waitingOn=ADMIN"
          onClick={() => onFilter("UNASSIGNED")}
        />
        <AttentionCount
          label="Chờ trên 24 giờ"
          hint="Tuổi công việc"
          query="minAgeHours=24"
          onClick={() => onFilter("OLDER_24")}
        />
      </div>
    </DashboardPanel>
  );
}
function AttentionCount({
  label,
  hint,
  query,
  onClick,
}: Readonly<{
  label: string;
  hint: string;
  query: string;
  onClick: () => void;
}>) {
  const count = useWorkCount(query);
  return (
    <AttentionRow
      label={label}
      value={count.label}
      hint={hint}
      onClick={onClick}
    />
  );
}
function AttentionRow({
  label,
  value,
  hint,
  onClick,
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}>) {
  return (
    <button type="button" onClick={onClick}>
      <strong className={styles.attentionNumber}>{value}</strong>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <Icon name="right" size={16} />
    </button>
  );
}
export function SessionDistribution({
  completed,
  scheduled,
}: Readonly<{ completed?: number; scheduled?: number }>) {
  const rows: [string, number | undefined][] = [
    ["Hoàn thành", completed],
    [
      "Chưa ghi nhận hoàn thành",
      scheduled !== undefined && completed !== undefined
        ? Math.max(0, scheduled - completed)
        : undefined,
    ],
  ];
  return (
    <DashboardPanel
      title="Trạng thái buổi học"
      description="Đánh giá tại thời điểm cập nhật."
      actions={
        <span className={styles.scopePill}>
          {dashboardNumber(scheduled)} buổi
        </span>
      }
      footer="Tính trên các buổi có lịch trong khoảng đã chọn; chưa ghi nhận hoàn thành có thể bao gồm buổi chưa diễn ra hoặc đã hủy."
    >
      <div className={styles.horizontalBars}>
        {rows.map(([label, value]) => (
          <div className={styles.horizontalRow} key={label}>
            <span>{label}</span>
            <span className={styles.track}>
              {value !== undefined && (
                <span
                  style={{
                    width: `${Math.min(100, (value / Math.max(1, scheduled ?? value)) * 100)}%`,
                  }}
                />
              )}
            </span>
            <strong
              aria-label={value === undefined ? "Chưa có số liệu" : undefined}
            >
              {dashboardNumber(value)}
            </strong>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
type PathRow = {
  id: string;
  status: string;
  learningStage: string;
  participantA: { id: string; fullName: string };
  participantB: { id: string; fullName: string };
  updatedAt: string;
};
export function PathsToWatch() {
  const list = useDashboardList<PathRow>("learning-paths?limit=5");
  return (
    <DashboardPanel
      title="Lộ trình cần theo dõi"
      description="Lộ trình cập nhật gần đây. Một thỏa thuận hai chiều được tính là một lộ trình."
      actions={
        <Link className={styles.textLink} href="/admin/learning-paths">
          Xem tất cả →
        </Link>
      }
    >
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        reload={list.reload}
        emptyTitle="Chưa có lộ trình để theo dõi"
      >
        <div className={styles.tableScroll}>
          <table className={`${styles.table} ${styles.pathTable}`}>
            <thead>
              <tr>
                {[
                  "Lộ trình",
                  "Người tham gia",
                  "Học tập",
                  "Quyết toán",
                  "Việc tiếp theo",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>Lộ trình #{row.id.slice(0, 8)}</strong>
                    <small>{fmtDateTime(row.updatedAt)}</small>
                  </td>
                  <td>
                    {row.participantA.fullName}
                    <small>và {row.participantB.fullName}</small>
                  </td>
                  <td>
                    {systemCodeLabel(
                      row.learningStage,
                      systemCodeLabel(row.status),
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/learning-paths/${row.id}`}>
                      Xem chi tiết
                    </Link>
                  </td>
                  <td>
                    <Link
                      className={styles.textLink}
                      href={`/admin/learning-paths/${row.id}`}
                    >
                      Xem lộ trình →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueueState>
    </DashboardPanel>
  );
}
type DashboardPayment = {
  id: string;
  userId: string;
  status: string;
  paymentAmountVnd: string;
  creditAmount: string;
  createdAt: string;
  payosCheckout: { orderCode: string } | null;
};
export function RecentPayments({ query }: Readonly<{ query: string }>) {
  const period = new URLSearchParams(query);
  const params = new URLSearchParams({
    limit: "5",
    from: period.get("from")!,
    before: period.get("to")!,
  });
  const list = useDashboardList<DashboardPayment>(`payments?${params}`);
  return (
    <DashboardPanel
      title="Thanh toán gần đây"
      description="Đơn nạp được tạo trong kỳ; không phải doanh thu phí."
      actions={
        <Link className="btn btn-sm" href="/admin/credits?tab=payments">
          Xem đối soát
        </Link>
      }
    >
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        reload={list.reload}
        emptyTitle="Chưa có thanh toán trong kỳ này"
      >
        <div className={styles.tableScroll}>
          <table className={`${styles.table} ${styles.paymentTable}`}>
            <thead>
              <tr>
                {[
                  "Mã đơn",
                  "Người dùng",
                  "Số tiền",
                  "Credit",
                  "Trạng thái",
                  "Thời điểm",
                  "",
                ].map((label, index) => (
                  <th key={label || `action-${index}`} scope="col">
                    {label || <span className="sr-only">Chi tiết</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <code>
                      {payment.payosCheckout?.orderCode ??
                        `#${payment.id.slice(0, 8)}`}
                    </code>
                  </td>
                  <td>
                    <DashboardPerson id={payment.userId} />
                  </td>
                  <td>{dashboardMoney(payment.paymentAmountVnd, "₫")}</td>
                  <td>{dashboardMoney(payment.creditAmount)}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>{fmtDateTime(payment.createdAt)}</td>
                  <td>
                    <Link
                      className={styles.textLink}
                      href={`/admin/credits?tab=payments&paymentId=${payment.id}`}
                    >
                      Chi tiết →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueueState>
    </DashboardPanel>
  );
}
