"use client";
import { Icon } from "@/components/console/icon";
import {
  Badge,
  Card,
  PageHeader,
  Segmented,
  type Tone,
} from "@/components/console/ui";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ListPagination } from "@/components/pagination/list-pagination";
import type {
  MaterialStorageUsage,
  PlanEntitlements,
  SubscriptionCharge,
  SubscriptionPlan,
  SubscriptionPlanCode,
  SubscriptionUsage,
  UserSubscriptionRecord,
} from "@/features/learner/types";
import { fmtDateTime } from "@/lib/console/format";
import { financeNumber } from "@/lib/staff/finance-presentation";
import { hasPermission } from "@/lib/staff/permissions";
import {
  chargeKindLabel,
  computeAnnualSavings,
  formatEntitlementHighlights,
  formatStorageBytes,
  intervalLabel,
  planDisplayName,
  planTagline,
  recordingUsagePercent,
  storageUsagePercent,
  subscriptionStatusLabel,
} from "@/lib/subscriptions/presentation";
import { useId, useState } from "react";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import styles from "./admin-subscriptions.module.css";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { useStaffListPages } from "./use-staff-list-pages";
import { UserProfileReference } from "./user-profile-reference";

type AdminSubscriptionRow = UserSubscriptionRecord & { userId: string };

type AdminPlanVersion = SubscriptionPlan & {
  id?: string;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  approvedAt: string | null;
  approvedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

type AdminUserSubscriptionDetail = {
  userId: string;
  subscriptions: UserSubscriptionRecord[];
  entitlements: PlanEntitlements;
  usage: SubscriptionUsage | null;
  materialStorage: MaterialStorageUsage;
  charges: SubscriptionCharge[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const planDefaults: Record<
  SubscriptionPlanCode,
  {
    monthPrice: string;
    yearPrice: string;
    storageGb: number;
    whiteboardDays: number;
    recordingMinutes: number;
    recordingDays: number;
  }
> = {
  CREATOR: {
    monthPrice: "99",
    yearPrice: "950",
    storageGb: 10,
    whiteboardDays: 180,
    recordingMinutes: 120,
    recordingDays: 30,
  },
  PRO: {
    monthPrice: "299",
    yearPrice: "2870",
    storageGb: 50,
    whiteboardDays: 365,
    recordingMinutes: 400,
    recordingDays: 90,
  },
};

function statusTone(status: string): Tone {
  if (status === "ACTIVE" || status === "APPROVED") return "ok";
  if (status === "GRACE" || status === "DRAFT") return "warn";
  if (status === "RETIRED") return "bad";
  return "neutral";
}

function meterFillClass(percent: number): string {
  if (percent >= 95)
    return `${styles.meterFill ?? ""} ${styles.meterFillDanger ?? ""}`;
  if (percent >= 80)
    return `${styles.meterFill ?? ""} ${styles.meterFillWarn ?? ""}`;
  return styles.meterFill ?? "";
}

function pickCurrentApprovedPlan(
  versions: readonly AdminPlanVersion[],
  code: SubscriptionPlanCode,
): { plan: AdminPlanVersion | null; state: "live" | "scheduled" | "none" } {
  const approved = versions.filter(
    (v) => v.planCode === code && v.status === "APPROVED" && v.effectiveAt,
  );
  if (!approved.length) return { plan: null, state: "none" };
  const nowMs = Date.now();
  const sortNewest = (a: AdminPlanVersion, b: AdminPlanVersion) => {
    const diff =
      Date.parse(b.effectiveAt ?? "") - Date.parse(a.effectiveAt ?? "");
    return diff !== 0 ? diff : b.versionNo - a.versionNo;
  };
  const live = approved
    .filter((v) => Date.parse(v.effectiveAt ?? "") <= nowMs)
    .sort(sortNewest);
  if (live[0]) return { plan: live[0], state: "live" };
  const upcoming = [...approved].sort(
    (a, b) => Date.parse(a.effectiveAt ?? "") - Date.parse(b.effectiveAt ?? ""),
  );
  return { plan: upcoming[0] ?? null, state: "scheduled" };
}

function PlanOverviewStrip({
  approvedPlans,
  loading,
  canManage,
  portal,
}: Readonly<{
  approvedPlans: readonly AdminPlanVersion[];
  loading: boolean;
  canManage: boolean;
  portal: string;
}>) {
  if (loading && approvedPlans.length === 0) {
    return (
      <LoadingSkeleton
        variant="section"
        label="Đang tải tổng quan phiên bản gói"
      />
    );
  }

  const creator = pickCurrentApprovedPlan(approvedPlans, "CREATOR");
  const pro = pickCurrentApprovedPlan(approvedPlans, "PRO");

  const renderPlanKpi = (
    code: SubscriptionPlanCode,
    picked: {
      plan: AdminPlanVersion | null;
      state: "live" | "scheduled" | "none";
    },
    highlight = false,
  ) => {
    const { plan, state } = picked;
    return (
      <div
        className={
          highlight
            ? `${styles.kpiCard} ${styles.kpiCardHighlight}`
            : styles.kpiCard
        }
      >
        <div className={styles.kpiTop}>
          <span className={styles.kpiTitleGroup}>
            <span className={styles.kpiIcon} aria-hidden="true">
              <Icon name={code === "PRO" ? "award" : "star"} size={15} />
            </span>
            <span>Gói {planDisplayName(code)}</span>
          </span>
          {state === "live" && plan && (
            <Badge tone="ok">Đang mở bán · v{plan.versionNo}</Badge>
          )}
          {state === "scheduled" && plan && (
            <Badge tone="info">Chờ hiệu lực · v{plan.versionNo}</Badge>
          )}
          {state === "none" && <Badge tone="warn">Chưa mở bán</Badge>}
        </div>

        {plan ? (
          <>
            <div className={styles.kpiValue}>
              {financeNumber(plan.monthPrice)} <small>CR/tháng</small> ·{" "}
              {financeNumber(plan.yearPrice)} <small>CR/năm</small>
            </div>
            <div className={styles.kpiMeta}>
              <span className={styles.kpiChip}>
                {formatStorageBytes(plan.entitlements.materialStorageBytes)}
              </span>
              <span className={styles.kpiChip}>
                {plan.entitlements.recordingMinutesPerPeriod}p ghi hình
              </span>
              <span className={styles.kpiChip}>
                {plan.entitlements.whiteboardRetentionDays} ngày bảng trắng
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.kpiValue}>Chưa có biểu phí</div>
            <div className={styles.kpiMeta}>
              <span>
                Tạo bản nháp và phê duyệt phiên bản gói để mở bán cho người
                dùng.
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <section
      className={styles.kpiGrid}
      aria-label="Tổng quan gói thành viên hiện hành"
    >
      {renderPlanKpi("CREATOR", creator, false)}
      {renderPlanKpi("PRO", pro, true)}
      <div className={styles.kpiCard}>
        <div className={styles.kpiTop}>
          <span className={styles.kpiTitleGroup}>
            <span className={styles.kpiIcon} aria-hidden="true">
              <Icon name="shield" size={15} />
            </span>
            <span>Phạm vi vận hành</span>
          </span>
          <Badge tone={canManage ? "brand" : "neutral"}>
            {canManage ? "Toàn quyền quản lý" : "Chế độ chỉ xem"}
          </Badge>
        </div>
        <div className={styles.kpiValue}>
          {approvedPlans.length} <small>phiên bản đã duyệt</small>
        </div>
        <div className={styles.kpiMeta}>
          <span>
            {canManage
              ? "Có thể tạo bản nháp, phê duyệt lịch mở bán và ngừng bán phiên bản gói."
              : portal === "staff"
                ? "Cổng nhân viên hỗ trợ tra cứu gói, hạn mức và lịch sử thanh toán của người dùng."
                : "Tài khoản hiện chỉ có quyền xem dữ liệu gói thành viên."}
          </span>
        </div>
      </div>
    </section>
  );
}

function UserSubscriptionDetailDrawer({
  userId,
  onClose,
}: Readonly<{ userId: string; onClose: () => void }>) {
  const detail = useStaffResource<AdminUserSubscriptionDetail>(
    `subscriptions/users/${userId}`,
  );
  const data = detail.data;
  const activeSub = data?.subscriptions.find(
    (sub) => sub.status === "ACTIVE" || sub.status === "GRACE",
  );
  const storagePct = data
    ? storageUsagePercent(
        data.materialStorage.usedBytes,
        data.materialStorage.allowedBytes,
      )
    : 0;
  const recordingPct = data?.usage
    ? recordingUsagePercent(
        data.usage.recordingMinutesUsed,
        data.usage.recordingMinutesAllowed,
      )
    : 0;

  return (
    <AdminDrawer
      title="Chi tiết gói thành viên người dùng"
      subtitle={<RecordId id={userId} label="mã người dùng" />}
      wide
      close={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <QueueState
        loading={detail.loading}
        error={detail.error}
        empty={!data}
        reload={detail.reload}
      >
        {data && (
          <>
            <div className="admin-section">
              <div className="admin-field-grid">
                <AdminField label="Hồ sơ người dùng">
                  <UserProfileReference userId={data.userId} />
                </AdminField>
                <AdminField label="Gói đang hiệu lực">
                  {activeSub ? (
                    <div className={styles.planTitleRow}>
                      <strong>{planDisplayName(activeSub.planCode)}</strong>
                      <Badge tone={statusTone(activeSub.status)}>
                        {subscriptionStatusLabel(activeSub.status)}
                      </Badge>
                    </div>
                  ) : (
                    <Badge tone="neutral">Miễn phí (chưa có gói trả phí)</Badge>
                  )}
                </AdminField>
                {activeSub && (
                  <>
                    <AdminField label="Chu kỳ & tự động gia hạn">
                      {intervalLabel(activeSub.interval)} ·{" "}
                      {activeSub.autoRenew
                        ? "Tự động gia hạn: Bật"
                        : "Tự động gia hạn: Tắt"}
                    </AdminField>
                    <AdminField label="Thời hạn hiệu lực">
                      {fmtDateTime(activeSub.termStart)} →{" "}
                      {fmtDateTime(activeSub.termEnd)}
                    </AdminField>
                  </>
                )}
              </div>
            </div>

            <div className="admin-section">
              <h3>Hạn mức & mức sử dụng hiện tại</h3>
              <div className={styles.meterGrid}>
                <div className={styles.meterCard}>
                  <div className={styles.meterTop}>
                    <span>Dung lượng tài liệu</span>
                    <span>{storagePct}%</span>
                  </div>
                  <div className={styles.meterValue}>
                    {formatStorageBytes(data.materialStorage.usedBytes)} /{" "}
                    {formatStorageBytes(data.materialStorage.allowedBytes)}
                  </div>
                  <div className={styles.meterTrack} aria-hidden="true">
                    <span
                      className={meterFillClass(storagePct)}
                      style={{ width: `${storagePct}%` }}
                    />
                  </div>
                  <span className={styles.meterFoot}>
                    {data.materialStorage.enforced
                      ? "Đang áp dụng giới hạn gói"
                      : "Đang theo dõi mức sử dụng"}
                  </span>
                </div>

                <div className={styles.meterCard}>
                  <div className={styles.meterTop}>
                    <span>Phút ghi hình kỳ này</span>
                    <span>
                      {data.usage ? `${recordingPct}%` : "Không áp dụng"}
                    </span>
                  </div>
                  {data.usage ? (
                    <>
                      <div className={styles.meterValue}>
                        {data.usage.recordingMinutesUsed} /{" "}
                        {data.usage.recordingMinutesAllowed} phút
                      </div>
                      <div className={styles.meterTrack} aria-hidden="true">
                        <span
                          className={meterFillClass(recordingPct)}
                          style={{ width: `${recordingPct}%` }}
                        />
                      </div>
                      <span className={styles.meterFoot}>
                        Add-on còn lại: {data.usage.addonMinutesRemaining} phút
                        · Hết kỳ {fmtDateTime(data.usage.periodEnd)}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className={styles.meterValue}>0 phút</div>
                      <span className={styles.meterFoot}>
                        Người dùng hiện không có gói ghi hình đang hoạt động.
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.entitlementGrid}>
                {formatEntitlementHighlights(data.entitlements).map((item) => (
                  <div key={item.label} className={styles.entitlementItem}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-section">
              <h3>Lịch sử đăng ký gói ({data.subscriptions.length})</h3>
              {data.subscriptions.length > 0 ? (
                <div className="table-wrap">
                  <table className={`table ${styles.responsiveTable}`}>
                    <thead>
                      <tr>
                        <th scope="col">Gói</th>
                        <th scope="col">Chu kỳ</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Hiệu lực</th>
                        <th scope="col">Gia hạn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subscriptions.map((sub) => (
                        <tr key={sub.id}>
                          <td data-label="Gói">
                            <strong>{planDisplayName(sub.planCode)}</strong>
                          </td>
                          <td data-label="Chu kỳ">
                            {intervalLabel(sub.interval)}
                          </td>
                          <td data-label="Trạng thái">
                            <Badge tone={statusTone(sub.status)}>
                              {subscriptionStatusLabel(sub.status)}
                            </Badge>
                          </td>
                          <td data-label="Hiệu lực">
                            <div className={styles.termCell}>
                              <span>Từ {fmtDateTime(sub.termStart)}</span>
                              <div>Đến {fmtDateTime(sub.termEnd)}</div>
                            </div>
                          </td>
                          <td data-label="Gia hạn">
                            <Badge tone={sub.autoRenew ? "ok" : "neutral"}>
                              {sub.autoRenew ? "Bật" : "Tắt"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">
                  Người dùng chưa từng đăng ký gói trả phí.
                </p>
              )}
            </div>

            <div className="admin-section">
              <h3>Lịch sử thanh toán gói ({data.charges.length})</h3>
              {data.charges.length > 0 ? (
                <div className="table-wrap">
                  <table className={`table ${styles.responsiveTable}`}>
                    <thead>
                      <tr>
                        <th scope="col">Loại giao dịch</th>
                        <th scope="col">Gói</th>
                        <th scope="col">SL</th>
                        <th scope="col">Credit</th>
                        <th scope="col">Thời điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.charges.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Loại giao dịch">
                            <strong>{chargeKindLabel(row.kind)}</strong>
                          </td>
                          <td data-label="Gói">
                            {planDisplayName(row.planCode)}
                          </td>
                          <td data-label="SL">{row.quantity}</td>
                          <td data-label="Credit">
                            <span className={styles.pricePrimary}>
                              {financeNumber(row.amount)} CR
                            </span>
                          </td>
                          <td data-label="Thời điểm">
                            {fmtDateTime(row.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Chưa có giao dịch thanh toán gói nào.</p>
              )}
            </div>
          </>
        )}
      </QueueState>
    </AdminDrawer>
  );
}

function SubscribersTab() {
  const [status, setStatus] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const [selectedUserId, setSelectedUserId] = useState<string>();

  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (planCode) params.set("planCode", planCode);
  if (userFilter) params.set("userId", userFilter);

  const list = useStaffListPages<AdminSubscriptionRow>(
    `subscriptions?${params}`,
  );

  function applyUserLookup(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = userDraft.trim();
    if (!trimmed) {
      setLookupError(undefined);
      setUserFilter("");
      return;
    }
    if (!uuidPattern.test(trimmed)) {
      setLookupError(
        "Mã người dùng chưa đúng định dạng UUID (ví dụ: 550e8400-e29b-41d4-a716-446655440000).",
      );
      return;
    }
    setLookupError(undefined);
    setUserFilter(trimmed);
    setSelectedUserId(trimmed);
  }

  function clearAllFilters() {
    setStatus("");
    setPlanCode("");
    setUserDraft("");
    setUserFilter("");
    setLookupError(undefined);
  }

  const activeFilterCount = [status, planCode, userFilter].filter(
    Boolean,
  ).length;

  return (
    <div className={styles.workspace}>
      <Card flush>
        <AdminFilterPanel
          flush
          activeCount={activeFilterCount}
          onClear={clearAllFilters}
          lead={
            <form onSubmit={applyUserLookup} className={styles.lookupForm}>
              <label className={styles.lookupInputWrap}>
                <span className="sr-only">Tra cứu người dùng theo UUID</span>
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Tra cứu nhanh theo userId (UUID)…"
                  value={userDraft}
                  onChange={(e) => {
                    setUserDraft(e.target.value);
                    if (lookupError) setLookupError(undefined);
                  }}
                />
              </label>
              <button type="submit" className="btn btn-primary btn-sm">
                Tra cứu
              </button>
              {userFilter && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setUserDraft("");
                    setUserFilter("");
                    setLookupError(undefined);
                  }}
                >
                  Xóa user
                </button>
              )}
            </form>
          }
          actions={
            <>
              <span className="muted">
                {list.items.length} bản ghi trên trang này
              </span>
              <LoadingButton
                type="button"
                className="btn btn-sm"
                loading={list.loading}
                onClick={() => void list.reload()}
              >
                <Icon name="refresh" size={14} />
                Làm mới
              </LoadingButton>
            </>
          }
        >
          <div className={filterPanelStyles.grid}>
            <label className={filterPanelStyles.field}>
              <span>Trạng thái gói</span>
              <select
                aria-label="Lọc trạng thái gói"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="GRACE">Đang chờ gia hạn (Grace)</option>
                <option value="EXPIRED">Đã hết hạn</option>
              </select>
            </label>
            <label className={filterPanelStyles.field}>
              <span>Mã gói</span>
              <select
                aria-label="Lọc mã gói"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
              >
                <option value="">Tất cả gói</option>
                <option value="CREATOR">Creator</option>
                <option value="PRO">Creator Pro</option>
              </select>
            </label>
          </div>
        </AdminFilterPanel>

        {lookupError && (
          <p className={styles.lookupError} role="alert">
            {lookupError}
          </p>
        )}

        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
          emptyTitle="Chưa có đăng ký gói nào phù hợp"
          emptyDescription="Thử thay đổi bộ lọc trạng thái, mã gói hoặc nhập UUID để mở trực tiếp hồ sơ gói người dùng."
        >
          <div className="table-wrap">
            <table className={`table ${styles.responsiveTable}`}>
              <thead>
                <tr>
                  <th scope="col">Người dùng</th>
                  <th scope="col">Gói & Chu kỳ</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Kỳ hiệu lực</th>
                  <th scope="col">Tự gia hạn</th>
                  <th scope="col" className={styles.actionCell}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((row) => {
                  const hasSchedule =
                    row.scheduledPlanCode || row.scheduledInterval;
                  return (
                    <tr key={row.id}>
                      <td data-label="Người dùng">
                        <UserProfileReference userId={row.userId} />
                      </td>
                      <td data-label="Gói & Chu kỳ">
                        <div className={styles.planCell}>
                          <div className={styles.planTitleRow}>
                            <strong>{planDisplayName(row.planCode)}</strong>
                            <Badge
                              tone={
                                row.planCode === "PRO" ? "brand" : "neutral"
                              }
                            >
                              {intervalLabel(row.interval)}
                            </Badge>
                          </div>
                          {hasSchedule && (
                            <span className={styles.scheduleHint}>
                              Kỳ tới:{" "}
                              {[
                                row.scheduledPlanCode
                                  ? planDisplayName(row.scheduledPlanCode)
                                  : null,
                                row.scheduledInterval
                                  ? intervalLabel(row.scheduledInterval)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Trạng thái">
                        <div className={styles.planCell}>
                          <div>
                            <Badge tone={statusTone(row.status)}>
                              {subscriptionStatusLabel(row.status)}
                            </Badge>
                          </div>
                          {row.graceUntil && (
                            <span className={styles.planSub}>
                              Chờ đến {fmtDateTime(row.graceUntil)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Kỳ hiệu lực">
                        <div className={styles.termCell}>
                          <span>Từ {fmtDateTime(row.termStart)}</span>
                          <div>Đến {fmtDateTime(row.termEnd)}</div>
                        </div>
                      </td>
                      <td data-label="Tự gia hạn">
                        <Badge tone={row.autoRenew ? "ok" : "neutral"}>
                          {row.autoRenew ? "Đang bật" : "Đang tắt"}
                        </Badge>
                      </td>
                      <td data-label="Thao tác" className={styles.actionCell}>
                        <div className={styles.actionGroup}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setSelectedUserId(row.userId)}
                          >
                            <Icon name="eye" size={14} />
                            Xem chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination query={list} />
        </QueueState>
      </Card>

      {selectedUserId && (
        <UserSubscriptionDetailDrawer
          key={selectedUserId}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(undefined)}
        />
      )}
    </div>
  );
}

function CreatePlanDraftDrawer({
  onClose,
  onCreated,
}: Readonly<{
  onClose: () => void;
  onCreated: (message: string) => void;
}>) {
  const { api } = useStaffSession();
  const formId = useId();
  const [planCode, setPlanCode] = useState<SubscriptionPlanCode>("CREATOR");
  const [monthPrice, setMonthPrice] = useState(planDefaults.CREATOR.monthPrice);
  const [yearPrice, setYearPrice] = useState(planDefaults.CREATOR.yearPrice);
  const [storageGb, setStorageGb] = useState(planDefaults.CREATOR.storageGb);
  const [whiteboardDays, setWhiteboardDays] = useState(
    planDefaults.CREATOR.whiteboardDays,
  );
  const [recordingMinutes, setRecordingMinutes] = useState(
    planDefaults.CREATOR.recordingMinutes,
  );
  const [recordingDays, setRecordingDays] = useState(
    planDefaults.CREATOR.recordingDays,
  );
  const [addonAllowed, setAddonAllowed] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function selectPlanCode(next: SubscriptionPlanCode) {
    const preset = planDefaults[next];
    setPlanCode(next);
    setMonthPrice(preset.monthPrice);
    setYearPrice(preset.yearPrice);
    setStorageGb(preset.storageGb);
    setWhiteboardDays(preset.whiteboardDays);
    setRecordingMinutes(preset.recordingMinutes);
    setRecordingDays(preset.recordingDays);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const safeGb = Number.isFinite(storageGb)
        ? Math.max(1, Math.round(storageGb))
        : 1;
      const materialStorageBytes = (BigInt(safeGb) * 1_000_000_000n).toString();
      await api("subscriptions/plans", {
        method: "POST",
        body: {
          planCode,
          monthPrice: monthPrice.trim(),
          yearPrice: yearPrice.trim(),
          entitlements: {
            feeTier: planCode,
            materialStorageBytes,
            whiteboardRetentionDays: whiteboardDays,
            recordingMinutesPerPeriod: recordingMinutes,
            recordingRetentionDays: recordingDays,
            recordingAddonAllowed: addonAllowed,
          },
          reason: reason.trim(),
        },
      });
      onCreated(
        `Đã tạo bản nháp phiên bản mới cho gói ${planDisplayName(planCode)}. Bạn có thể phê duyệt trong danh sách phiên bản.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa tạo được bản nháp gói.",
      );
    } finally {
      setBusy(false);
    }
  }

  const savings = computeAnnualSavings(monthPrice.trim(), yearPrice.trim());

  return (
    <AdminDrawer
      title="Tạo bản nháp phiên bản gói"
      subtitle="Phiên bản mới ở trạng thái Bản nháp và chỉ áp dụng cho người dùng sau khi được phê duyệt."
      busy={busy}
      close={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <LoadingButton
            type="submit"
            form={formId}
            className="btn btn-primary"
            loading={busy}
            disabled={busy}
          >
            Tạo bản nháp
          </LoadingButton>
        </>
      }
    >
      <form
        id={formId}
        className={styles.drawerForm}
        onSubmit={(e) => void handleSubmit(e)}
      >
        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}

        <div className={styles.formSection}>
          <h3>1. Chọn hạng gói</h3>
          <div
            className={styles.tierSelector}
            role="radiogroup"
            aria-label="Chọn hạng gói"
          >
            {(["CREATOR", "PRO"] as const).map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={planCode === code}
                disabled={busy}
                className={
                  planCode === code
                    ? `${styles.tierOption} ${styles.tierOptionActive}`
                    : styles.tierOption
                }
                onClick={() => selectPlanCode(code)}
              >
                <strong>{planDisplayName(code)}</strong>
                <small>{planTagline(code)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>2. Biểu giá Credit</h3>
          <fieldset className={styles.formGrid} disabled={busy}>
            <label className={styles.formField}>
              <span>Giá theo tháng (Credit)</span>
              <input
                required
                inputMode="decimal"
                placeholder="Ví dụ: 99"
                value={monthPrice}
                onChange={(e) => setMonthPrice(e.target.value)}
              />
              <span className={styles.fieldHint}>Chu kỳ 30 ngày</span>
            </label>
            <label className={styles.formField}>
              <span>Giá theo năm (Credit)</span>
              <input
                required
                inputMode="decimal"
                placeholder="Ví dụ: 950"
                value={yearPrice}
                onChange={(e) => setYearPrice(e.target.value)}
              />
              <span className={styles.fieldHint}>Chu kỳ 365 ngày</span>
            </label>

            {savings && savings.percent > 0 && (
              <div className={styles.savingsPreview}>
                <span>
                  Gói năm tiết kiệm {savings.percent}% (
                  {financeNumber(String(savings.savedCredit))} Credit)
                </span>
                <span>
                  ≈ {financeNumber(String(savings.monthlyEquivalent))} CR/tháng
                </span>
              </div>
            )}
          </fieldset>
        </div>

        <div className={styles.formSection}>
          <h3>3. Quyền lợi & hạn mức</h3>
          <fieldset className={styles.formGrid} disabled={busy}>
            <label className={styles.formField}>
              <span>Dung lượng tài liệu (GB)</span>
              <input
                type="number"
                min={1}
                max={10000}
                required
                value={storageGb}
                onChange={(e) => setStorageGb(Number(e.target.value))}
              />
              <span className={styles.fieldHint}>Từ 1 đến 10.000 GB</span>
            </label>
            <label className={styles.formField}>
              <span>Lưu bảng trắng (ngày)</span>
              <input
                type="number"
                min={8}
                max={3650}
                required
                value={whiteboardDays}
                onChange={(e) => setWhiteboardDays(Number(e.target.value))}
              />
              <span className={styles.fieldHint}>Từ 8 đến 3.650 ngày</span>
            </label>
            <label className={styles.formField}>
              <span>Phút ghi hình mỗi kỳ (30 ngày)</span>
              <input
                type="number"
                min={0}
                max={100000}
                required
                value={recordingMinutes}
                onChange={(e) => setRecordingMinutes(Number(e.target.value))}
              />
              <span className={styles.fieldHint}>Đặt 0 nếu không bao gồm</span>
            </label>
            <label className={styles.formField}>
              <span>Lưu bản ghi buổi học (ngày)</span>
              <input
                type="number"
                min={1}
                max={3650}
                required
                value={recordingDays}
                onChange={(e) => setRecordingDays(Number(e.target.value))}
              />
              <span className={styles.fieldHint}>Từ 1 đến 3.650 ngày</span>
            </label>

            <label className={styles.checkboxCard}>
              <input
                type="checkbox"
                checked={addonAllowed}
                onChange={(e) => setAddonAllowed(e.target.checked)}
              />
              <span>
                <strong>Cho phép mua thêm phút ghi hình (Add-on)</strong>
                <small>
                  Người dùng thuộc gói này có thể mua thêm gói 60 phút trong kỳ
                  khi cần.
                </small>
              </span>
            </label>
          </fieldset>
        </div>

        <div className={styles.formSection}>
          <h3>4. Nhật ký kiểm tra (Audit)</h3>
          <fieldset className={styles.formGrid} disabled={busy}>
            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Lý do tạo bản nháp *</span>
              <textarea
                required
                maxLength={500}
                placeholder="Ví dụ: Điều chỉnh biểu phí và hạn mức ghi hình gói Creator theo kế hoạch quý mới…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </fieldset>
        </div>
      </form>
    </AdminDrawer>
  );
}

function buildPlanDecisionBody(
  action: "approve" | "retire",
  reason: string,
  scheduleMode: "now" | "custom",
  effectiveAt: string,
): Record<string, unknown> {
  if (action === "retire") return { reason: reason.trim() };
  const parsed =
    scheduleMode === "custom" && effectiveAt
      ? new Date(effectiveAt)
      : new Date(Date.now() + 60_000);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Thời điểm hiệu lực không hợp lệ.");
  }
  return { effectiveAt: parsed.toISOString(), reason: reason.trim() };
}

function PlanDecisionDrawer({
  plan,
  action,
  onDone,
  onCancel,
}: Readonly<{
  plan: AdminPlanVersion;
  action: "approve" | "retire";
  onDone: (message: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const { api } = useStaffSession();
  const formId = useId();
  const [scheduleMode, setScheduleMode] = useState<"now" | "custom">("now");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const isApprove = action === "approve";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const endpoint = `subscriptions/plans/${plan.planVersionId}/${action}`;
      await api(endpoint, {
        method: "POST",
        body: buildPlanDecisionBody(action, reason, scheduleMode, effectiveAt),
      });
      const message = isApprove
        ? `Đã phê duyệt ${planDisplayName(plan.planCode)} v${plan.versionNo}.`
        : `Đã ngừng bán ${planDisplayName(plan.planCode)} v${plan.versionNo}.`;
      await onDone(message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật trạng thái phiên bản gói.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDrawer
      title={
        isApprove
          ? `Phê duyệt ${planDisplayName(plan.planCode)} v${plan.versionNo}`
          : `Ngừng bán ${planDisplayName(plan.planCode)} v${plan.versionNo}`
      }
      subtitle={<RecordId id={plan.planVersionId} label="mã phiên bản gói" />}
      busy={busy}
      close={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onCancel}
          >
            Hủy
          </button>
          <LoadingButton
            type="submit"
            form={formId}
            className={isApprove ? "btn btn-primary" : "btn btn-danger"}
            loading={busy}
            disabled={busy}
          >
            {isApprove ? "Phê duyệt mở bán" : "Xác nhận ngừng bán"}
          </LoadingButton>
        </>
      }
    >
      <div className={styles.drawerForm}>
        <div className={styles.decisionSummary}>
          <div className={styles.decisionSummaryHead}>
            <strong>
              {planDisplayName(plan.planCode)} · Phiên bản v{plan.versionNo}
            </strong>
            <Badge tone={statusTone(plan.status)}>
              {subscriptionStatusLabel(plan.status)}
            </Badge>
          </div>
          <div className={styles.priceCell}>
            <span className={styles.pricePrimary}>
              {financeNumber(plan.monthPrice)} CR / tháng ·{" "}
              {financeNumber(plan.yearPrice)} CR / năm
            </span>
          </div>
          <div className={styles.entitlementPills}>
            <span className={styles.entitlementChip}>
              {formatStorageBytes(plan.entitlements.materialStorageBytes)} tài
              liệu
            </span>
            <span className={styles.entitlementChip}>
              {plan.entitlements.recordingMinutesPerPeriod} phút ghi (lưu{" "}
              {plan.entitlements.recordingRetentionDays} ngày)
            </span>
            <span className={styles.entitlementChip}>
              {plan.entitlements.whiteboardRetentionDays} ngày bảng trắng
            </span>
            <span className={styles.entitlementChip}>
              Add-on: {plan.entitlements.recordingAddonAllowed ? "Có" : "Không"}
            </span>
          </div>
        </div>

        <AdminNotice tone={isApprove ? "info" : "warn"}>
          {isApprove
            ? "Sau thời điểm hiệu lực, người dùng đăng ký mới hoặc gia hạn kỳ tiếp theo sẽ áp dụng biểu phí và hạn mức của phiên bản này."
            : "Ngừng bán sẽ dừng nhận đăng ký mới cho phiên bản này. Người dùng đang trong kỳ trả phí hiện tại vẫn giữ nguyên quyền lợi đến hết kỳ."}
        </AdminNotice>

        <form
          id={formId}
          className={styles.drawerForm}
          onSubmit={(e) => void handleSubmit(e)}
        >
          {error && (
            <p className="staff-error" role="alert">
              {error}
            </p>
          )}

          <fieldset className={styles.formGrid} disabled={busy}>
            {isApprove && (
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <span>Thời điểm bắt đầu hiệu lực</span>
                <div className={styles.scheduleChoiceRow}>
                  <button
                    type="button"
                    className={
                      scheduleMode === "now"
                        ? "btn btn-sm btn-primary"
                        : "btn btn-sm"
                    }
                    onClick={() => setScheduleMode("now")}
                  >
                    Hiệu lực ngay (sau 1 phút)
                  </button>
                  <button
                    type="button"
                    className={
                      scheduleMode === "custom"
                        ? "btn btn-sm btn-primary"
                        : "btn btn-sm"
                    }
                    onClick={() => setScheduleMode("custom")}
                  >
                    Hẹn lịch cụ thể
                  </button>
                </div>
                {scheduleMode === "custom" && (
                  <input
                    type="datetime-local"
                    required
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                )}
              </div>
            )}

            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Lý do xác nhận (ghi nhận nhật ký kiểm tra) *</span>
              <textarea
                required
                maxLength={500}
                placeholder={
                  isApprove
                    ? "Ví dụ: Phê duyệt mở bán chính thức theo quyết định biểu phí…"
                    : "Ví dụ: Thay thế bằng phiên bản biểu phí mới…"
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </fieldset>
        </form>
      </div>
    </AdminDrawer>
  );
}

function PlanVersionsTab({
  canManage,
  approvedPlans,
  onMutated,
}: Readonly<{
  canManage: boolean;
  approvedPlans: readonly AdminPlanVersion[];
  onMutated: (message: string) => void;
}>) {
  const [planCode, setPlanCode] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<{
    plan: AdminPlanVersion;
    action: "approve" | "retire";
  } | null>(null);

  const params = new URLSearchParams({ limit: "20" });
  if (planCode) params.set("planCode", planCode);
  if (status) params.set("status", status);
  const list = useStaffListPages<AdminPlanVersion>(
    `subscriptions/plans?${params}`,
  );

  const liveCreatorId =
    pickCurrentApprovedPlan(approvedPlans, "CREATOR").state === "live"
      ? pickCurrentApprovedPlan(approvedPlans, "CREATOR").plan?.planVersionId
      : undefined;
  const liveProId =
    pickCurrentApprovedPlan(approvedPlans, "PRO").state === "live"
      ? pickCurrentApprovedPlan(approvedPlans, "PRO").plan?.planVersionId
      : undefined;

  const activeFilterCount = [planCode, status].filter(Boolean).length;

  return (
    <div className={styles.workspace}>
      <Card flush>
        <AdminFilterPanel
          flush
          activeCount={activeFilterCount}
          onClear={() => {
            setPlanCode("");
            setStatus("");
          }}
          actions={
            <>
              <span className="muted">
                {list.items.length} phiên bản trên trang này
              </span>
              <LoadingButton
                type="button"
                className="btn btn-sm"
                loading={list.loading}
                onClick={() => void list.reload()}
              >
                <Icon name="refresh" size={14} />
                Làm mới
              </LoadingButton>
            </>
          }
        >
          <div className={filterPanelStyles.grid}>
            <label className={filterPanelStyles.field}>
              <span>Mã gói</span>
              <select
                aria-label="Lọc mã gói"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
              >
                <option value="">Tất cả gói</option>
                <option value="CREATOR">Creator</option>
                <option value="PRO">Creator Pro</option>
              </select>
            </label>
            <label className={filterPanelStyles.field}>
              <span>Trạng thái phiên bản</span>
              <select
                aria-label="Lọc trạng thái phiên bản"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="RETIRED">Đã ngừng bán</option>
              </select>
            </label>
          </div>
        </AdminFilterPanel>

        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
          emptyTitle="Chưa có phiên bản gói thành viên"
          emptyDescription={
            canManage
              ? "Nhấn Tạo phiên bản gói ở góc trên để tạo bản nháp và phê duyệt mở bán."
              : "Chưa có phiên bản gói nào khớp với bộ lọc hiện tại."
          }
        >
          <div className="table-wrap">
            <table className={`table ${styles.responsiveTable}`}>
              <thead>
                <tr>
                  <th scope="col">Gói & Phiên bản</th>
                  <th scope="col">Biểu giá Credit</th>
                  <th scope="col">Quyền lợi & Hạn mức</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hiệu lực từ</th>
                  {canManage && (
                    <th scope="col" className={styles.actionCell}>
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.items.map((plan) => {
                  const isLive =
                    plan.planVersionId === liveCreatorId ||
                    plan.planVersionId === liveProId;
                  const savings = computeAnnualSavings(
                    plan.monthPrice,
                    plan.yearPrice,
                  );
                  return (
                    <tr key={plan.planVersionId}>
                      <td data-label="Gói & Phiên bản">
                        <div className={styles.planCell}>
                          <div className={styles.planTitleRow}>
                            <strong>{planDisplayName(plan.planCode)}</strong>
                            <Badge tone="neutral">v{plan.versionNo}</Badge>
                            {isLive && <Badge tone="brand">Đang áp dụng</Badge>}
                          </div>
                          <RecordId
                            id={plan.planVersionId}
                            label="mã phiên bản"
                          />
                        </div>
                      </td>
                      <td data-label="Biểu giá Credit">
                        <div className={styles.priceCell}>
                          <span className={styles.pricePrimary}>
                            {financeNumber(plan.monthPrice)} CR / tháng
                          </span>
                          <span className={styles.priceSecondary}>
                            {financeNumber(plan.yearPrice)} CR / năm
                            {savings && savings.percent > 0
                              ? ` (-${savings.percent}%)`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td data-label="Quyền lợi & Hạn mức">
                        <div className={styles.entitlementPills}>
                          <span className={styles.entitlementChip}>
                            {formatStorageBytes(
                              plan.entitlements.materialStorageBytes,
                            )}{" "}
                            tài liệu
                          </span>
                          <span className={styles.entitlementChip}>
                            {plan.entitlements.recordingMinutesPerPeriod}p ghi ·
                            lưu {plan.entitlements.recordingRetentionDays}d
                          </span>
                          <span className={styles.entitlementChip}>
                            {plan.entitlements.whiteboardRetentionDays}d bảng
                            trắng
                          </span>
                          <span className={styles.entitlementChip}>
                            Add-on:{" "}
                            {plan.entitlements.recordingAddonAllowed
                              ? "Có"
                              : "Không"}
                          </span>
                        </div>
                      </td>
                      <td data-label="Trạng thái">
                        <Badge tone={statusTone(plan.status)}>
                          {subscriptionStatusLabel(plan.status)}
                        </Badge>
                      </td>
                      <td data-label="Hiệu lực từ">
                        <div className={styles.termCell}>
                          <div>
                            {plan.effectiveAt
                              ? fmtDateTime(plan.effectiveAt)
                              : "Chưa lên lịch"}
                          </div>
                          <span>Tạo: {fmtDateTime(plan.createdAt)}</span>
                        </div>
                      </td>
                      {canManage && (
                        <td data-label="Thao tác" className={styles.actionCell}>
                          <div className={styles.actionGroup}>
                            {plan.status === "DRAFT" && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() =>
                                  setSelected({ plan, action: "approve" })
                                }
                              >
                                <Icon name="check" size={14} />
                                Phê duyệt
                              </button>
                            )}
                            {plan.status === "APPROVED" && (
                              <button
                                type="button"
                                className="btn btn-sm admin-danger-outline"
                                onClick={() =>
                                  setSelected({ plan, action: "retire" })
                                }
                              >
                                Ngừng bán
                              </button>
                            )}
                            {plan.status === "RETIRED" && (
                              <span className="muted">Đã ngừng</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination query={list} />
        </QueueState>
      </Card>

      {canManage && selected && (
        <PlanDecisionDrawer
          key={`${selected.plan.planVersionId}:${selected.action}`}
          plan={selected.plan}
          action={selected.action}
          onDone={async (message) => {
            setSelected(null);
            await list.reload();
            onMutated(message);
          }}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export function SubscriptionsAdminScreen() {
  const { actor, portal } = useStaffSession();
  const canRead = hasPermission(actor, "subscription:read");
  const canManage =
    portal === "admin" && hasPermission(actor, "subscription:manage");
  const [tab, setTab] = useState<"subscribers" | "plans">("subscribers");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  const approvedOverview = useStaffResource<AdminPlanVersion[]>(
    "subscriptions/plans?status=APPROVED&limit=20",
    { enabled: canRead },
  );

  if (!canRead) {
    return (
      <section className="ops-page">
        <PageHeader
          title="Gói thành viên"
          desc="Quản lý gói thành viên, quyền lợi và danh sách người dùng đăng ký."
        />
        <AdminNotice tone="warn">
          Tài khoản hiện chưa được cấp quyền xem dữ liệu gói thành viên.
        </AdminNotice>
      </section>
    );
  }

  function handlePlanMutation(message: string) {
    setNotice(message);
    void approvedOverview.reload();
    setRefreshKey((k) => k + 1);
  }

  return (
    <section className={`ops-page ${styles.workspace}`}>
      <PageHeader
        title="Gói thành viên"
        desc={
          canManage
            ? "Theo dõi người dùng đăng ký, hạn mức ghi hình/tài liệu và phát hành các phiên bản gói mở bán."
            : "Tra cứu trạng thái gói thành viên, mức sử dụng hạn mức và cấu hình các phiên bản gói."
        }
        actions={
          <div className="row">
            <LoadingButton
              type="button"
              className="btn"
              loading={approvedOverview.loading}
              onClick={() => {
                void approvedOverview.reload();
                setRefreshKey((k) => k + 1);
              }}
            >
              <Icon name="refresh" size={15} />
              Làm mới
            </LoadingButton>
            {canManage && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreatingPlan(true)}
              >
                <Icon name="plus" size={15} />
                Tạo phiên bản gói
              </button>
            )}
          </div>
        }
      />

      {notice && (
        <output className={`staff-success ${styles.inlineBanner}`}>
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setNotice(undefined)}
          >
            Đóng
          </button>
        </output>
      )}

      <PlanOverviewStrip
        approvedPlans={approvedOverview.data ?? []}
        loading={approvedOverview.loading}
        canManage={canManage}
        portal={portal}
      />

      <div className="ops-tabbar">
        <Segmented
          label="Mục quản lý gói thành viên"
          value={tab}
          onChange={setTab}
          options={[
            { id: "subscribers", label: "Người dùng đăng ký" },
            { id: "plans", label: "Phiên bản gói" },
          ]}
        />
      </div>

      {tab === "subscribers" ? (
        <SubscribersTab key={refreshKey} />
      ) : (
        <PlanVersionsTab
          key={refreshKey}
          canManage={canManage}
          approvedPlans={approvedOverview.data ?? []}
          onMutated={handlePlanMutation}
        />
      )}

      {canManage && creatingPlan && (
        <CreatePlanDraftDrawer
          onClose={() => setCreatingPlan(false)}
          onCreated={(message) => {
            setCreatingPlan(false);
            setTab("plans");
            handlePlanMutation(message);
          }}
        />
      )}
    </section>
  );
}
