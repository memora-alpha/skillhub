"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import { useState } from "react";
import { Badge, Empty, StatusBadge } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { PasswordInput } from "@/components/password-input";
import { AdminDrawer, AdminNotice } from "./admin-ui";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { QueueState } from "./common";
import { useOperation } from "./operation-tools";
import { fmtDateTime } from "@/lib/console/format";
import {
  creditDirection,
  creditToVndEstimate,
  feeRevenueQuery,
  financeLabel,
  financeNumber,
  sumCreditStrings,
  utcDatePresetRange,
  type RevenuePreset,
} from "@/lib/staff/finance-presentation";
import styles from "./admin-finance.module.css";

type Fee = {
  id: string;
  policyCode: string;
  versionNo: number;
  status: string;
  effective: boolean;
  effectiveAt: string | null;
  calculationRule: { feeBps?: number; platformFeeBps?: number };
};

type FeePolicyCode =
  | "ONE_WAY"
  | "TWO_WAY"
  | "MATERIAL_PAID"
  | "ONE_WAY_CREATOR"
  | "ONE_WAY_PRO"
  | "MATERIAL_PAID_CREATOR"
  | "MATERIAL_PAID_PRO";

const feePolicyCodes: readonly FeePolicyCode[] = [
  "TWO_WAY",
  "ONE_WAY",
  "ONE_WAY_CREATOR",
  "ONE_WAY_PRO",
  "MATERIAL_PAID",
  "MATERIAL_PAID_CREATOR",
  "MATERIAL_PAID_PRO",
];

type Revenue = {
  timezone: string;
  items: {
    period: string;
    business: string;
    collectedCredit: string;
    refundedCredit: string;
    netCredit: string;
  }[];
};

type PolicyAction =
  | { mode: "create" }
  | { mode: "edit"; fee: Fee }
  | { mode: "approve"; fee: Fee }
  | { mode: "delete"; fee: Fee };

type PolicyFilter = "ALL" | "EFFECTIVE" | "DRAFT" | "APPROVED";

function feeBpsOf(fee: Fee): number | null {
  if (typeof fee.calculationRule.feeBps === "number") {
    return fee.calculationRule.feeBps;
  }
  if (typeof fee.calculationRule.platformFeeBps === "number") {
    return fee.calculationRule.platformFeeBps;
  }
  return null;
}

function feeSplitText(policyCode: string, feeBps: number | null) {
  if (feeBps === null) return "Theo cấu hình hệ thống";
  const receiverPct = (10000 - feeBps) / 100;
  return policyCode.startsWith("MATERIAL_PAID")
    ? `Tác giả nhận ${receiverPct}%`
    : `Hoàn/trả ${receiverPct}%`;
}

export function MaterialFeePolicies({
  vndPerCredit,
  onPolicyChanged,
}: Readonly<{
  vndPerCredit?: number;
  onPolicyChanged?: () => void;
}>) {
  const list = useStaffListPages<Fee>("fee-policies?limit=20");
  const [action, setAction] = useState<PolicyAction | null>(null);
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>("ALL");
  const [notice, setNotice] = useState("");

  const visibleItems = list.items.filter((item) => {
    if (policyFilter === "EFFECTIVE") return item.effective;
    if (policyFilter === "DRAFT") return item.status === "DRAFT";
    if (policyFilter === "APPROVED")
      return item.status === "APPROVED" && !item.effective;
    return true;
  });

  const filterCounts = {
    ALL: list.items.length,
    EFFECTIVE: list.items.filter((i) => i.effective).length,
    DRAFT: list.items.filter((i) => i.status === "DRAFT").length,
    APPROVED: list.items.filter((i) => i.status === "APPROVED" && !i.effective)
      .length,
  };

  return (
    <div className={styles.workspace}>
      {notice && (
        <output className={`staff-success ${styles.inlineSuccess}`}>
          <span>{notice}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setNotice("")}
          >
            Đóng
          </button>
        </output>
      )}

      {/* Fee Policies Section */}
      <section className={styles.sectionCard} aria-label="Chính sách phí">
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleBlock}>
            <h2>Chính sách phí nền tảng</h2>
            <p>
              Theo dõi mức phí và thời điểm áp dụng. Mọi thay đổi đều tạo bản
              nháp, xác thực lại mật khẩu Admin và phê duyệt trước khi có hiệu
              lực. Thỏa thuận đã khóa tiếp tục dùng phiên bản phí đã chốt.
            </p>
          </div>
          <div className={styles.cardHeaderActions}>
            <LoadingButton
              type="button"
              className="btn"
              disabled={list.loading}
              loading={!!list.loading}
              onClick={() => void list.reload()}
            >
              <Icon name="refresh" size={15} />
              Làm mới
            </LoadingButton>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAction({ mode: "create" })}
            >
              <Icon name="plus" size={15} />
              Tạo bản nháp
            </button>
          </div>
        </div>

        {/* Filter chips for current page */}
        <div
          className={styles.chipStrip}
          role="group"
          aria-label="Lọc nhanh trạng thái chính sách phí"
        >
          {(
            [
              ["ALL", "Tất cả"],
              ["EFFECTIVE", "Đang áp dụng"],
              ["DRAFT", "Bản nháp"],
              ["APPROVED", "Đã duyệt (lịch sử/chờ)"],
            ] as const
          ).map(([id, label]) => {
            const active = policyFilter === id;
            return (
              <button
                key={id}
                type="button"
                className={
                  active
                    ? `${styles.filterChip} ${styles.filterChipActive}`
                    : styles.filterChip
                }
                aria-pressed={active}
                onClick={() => setPolicyFilter(id)}
              >
                <span>{label}</span>
                {list.items.length > 0 && <span>({filterCounts[id]})</span>}
              </button>
            );
          })}
        </div>

        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!visibleItems.length}
          reload={list.reload}
          emptyTitle={
            policyFilter === "ALL"
              ? "Chưa có chính sách phí"
              : "Không có phiên bản ở trạng thái này"
          }
          emptyDescription={
            policyFilter === "ALL"
              ? "Nhấn Tạo bản nháp để thiết lập phiên bản phí mới."
              : "Thử chọn lại bộ lọc Tất cả để xem các phiên bản khác."
          }
        >
          {/* Desktop Table */}
          <div className={styles.desktopTableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th scope="col">Phạm vi / Phiên bản</th>
                  <th scope="col">Mức phí & phân bổ</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hiệu lực từ</th>
                  <th scope="col" className={styles.actionHead}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((f) => {
                  const bps = feeBpsOf(f);
                  const rateLabel =
                    bps !== null ? `${bps / 100}%` : "Theo chính sách";
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className={styles.primaryStack}>
                          <strong>{financeLabel(f.policyCode)}</strong>
                          <span className={styles.metaText}>
                            Phiên bản {f.versionNo}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.primaryStack}>
                          <div>
                            <span className={styles.feePercent}>
                              {rateLabel}
                            </span>
                          </div>
                          <span className={styles.metaText}>
                            {feeSplitText(f.policyCode, bps)}
                          </span>
                        </div>
                      </td>
                      <td>
                        {f.effective ? (
                          <Badge tone="ok">Đang áp dụng</Badge>
                        ) : f.status === "DRAFT" ? (
                          <Badge tone="warn">Bản nháp</Badge>
                        ) : (
                          <StatusBadge status={f.status} />
                        )}
                      </td>
                      <td>
                        <span className={styles.metaText}>
                          {f.effectiveAt
                            ? fmtDateTime(f.effectiveAt)
                            : "Chưa lên lịch"}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        {f.status === "DRAFT" ? (
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() =>
                                setAction({ mode: "approve", fee: f })
                              }
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() =>
                                setAction({ mode: "edit", fee: f })
                              }
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm admin-danger-outline"
                              onClick={() =>
                                setAction({ mode: "delete", fee: f })
                              }
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <span className={styles.statusLocked}>
                            {f.effective ? "Đang hiệu lực" : "Đã chốt"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards */}
          <div className={styles.mobileCards}>
            {visibleItems.map((f) => {
              const bps = feeBpsOf(f);
              const rateLabel =
                bps !== null ? `${bps / 100}%` : "Theo chính sách";
              return (
                <article key={f.id} className={styles.itemCard}>
                  <div className={styles.itemCardHead}>
                    <div className={styles.itemCardTitle}>
                      <strong>{financeLabel(f.policyCode)}</strong>
                      <span className={styles.metaText}>
                        Phiên bản {f.versionNo}
                      </span>
                    </div>
                    <div className={styles.itemCardAmount}>
                      <span className={styles.feePercent}>{rateLabel}</span>
                      <span className={styles.metaText}>
                        {feeSplitText(f.policyCode, bps)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.itemCardMetaRow}>
                    <div>
                      {f.effective ? (
                        <Badge tone="ok">Đang áp dụng</Badge>
                      ) : f.status === "DRAFT" ? (
                        <Badge tone="warn">Bản nháp</Badge>
                      ) : (
                        <StatusBadge status={f.status} />
                      )}
                    </div>
                    <span>
                      {f.effectiveAt
                        ? `Hiệu lực: ${fmtDateTime(f.effectiveAt)}`
                        : "Chưa lên lịch"}
                    </span>
                  </div>

                  {f.status === "DRAFT" && (
                    <div className={styles.itemCardFoot}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setAction({ mode: "approve", fee: f })}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setAction({ mode: "edit", fee: f })}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm admin-danger-outline"
                        onClick={() => setAction({ mode: "delete", fee: f })}
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </QueueState>

        <div className={styles.footerWrap}>
          <ListPagination query={list} />
        </div>
      </section>

      {action && (
        <FeePolicyDrawer
          key={
            action.mode === "create"
              ? "create"
              : `${action.mode}:${action.fee.id}`
          }
          action={action}
          onClose={() => setAction(null)}
          onCompleted={async (message) => {
            setAction(null);
            setNotice(message);
            await list.reload();
            onPolicyChanged?.();
          }}
        />
      )}

      {/* Revenue Report Section */}
      <RevenueScreen vndPerCredit={vndPerCredit} />
    </div>
  );
}

/* ==========================================================================
   Slide-over Drawer for Creating / Editing / Approving / Deleting Fee Policy
   ========================================================================== */

function FeePolicyDrawer({
  action,
  onClose,
  onCompleted,
}: Readonly<{
  action: PolicyAction;
  onClose: () => void;
  onCompleted: (message: string) => Promise<void>;
}>) {
  const { api } = useStaffSession();
  const operation = useOperation();
  const mode = action.mode;
  const selected = mode === "create" ? undefined : action.fee;

  const initialCode: FeePolicyCode =
    selected && feePolicyCodes.includes(selected.policyCode as FeePolicyCode)
      ? (selected.policyCode as FeePolicyCode)
      : "MATERIAL_PAID";

  const [policyCode, setPolicyCode] = useState<FeePolicyCode>(initialCode);
  const nextVersionResource = useStaffResource<{
    policyCode: FeePolicyCode;
    nextVersion: number;
  }>(`fee-policies/next-version?${new URLSearchParams({ policyCode })}`, {
    retainOnReload: true,
    enabled: mode === "create",
  });
  const [version, setVersion] = useState<number>();
  const nextVersion = nextVersionResource.data?.nextVersion;

  const [feePercent, setFeePercent] = useState(() => {
    if (selected) {
      const bps = feeBpsOf(selected);
      if (bps !== null) return String(bps / 100);
    }
    return "5";
  });
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");

  const parsedFeeNum = Number(feePercent);
  const validFeePreview =
    /^\d+(?:\.\d{1,2})?$/.test(feePercent.trim()) &&
    parsedFeeNum >= 1 &&
    parsedFeeNum <= 10;
  const receiverPreview = validFeePreview
    ? Math.round((100 - parsedFeeNum) * 100) / 100
    : null;

  function drawerTitle() {
    if (mode === "create") return "Tạo bản nháp chính sách phí";
    if (mode === "edit") return "Chỉnh sửa bản nháp chính sách phí";
    if (mode === "approve") return "Phê duyệt chính sách phí";
    return "Xóa bản nháp chính sách phí";
  }

  function submitLabel() {
    if (operation.busy) return "Đang xử lý…";
    if (mode === "create") return "Tạo bản nháp";
    if (mode === "edit") return "Lưu thay đổi";
    if (mode === "approve") return "Phê duyệt phiên bản";
    return "Xác nhận xóa bản nháp";
  }

  const formId = "fee-policy-drawer-form";

  return (
    <AdminDrawer
      title={drawerTitle()}
      subtitle={
        selected
          ? `${financeLabel(selected.policyCode)} · Phiên bản ${selected.versionNo}`
          : "Chọn phạm vi, mức phí từ 1% đến 10% và xác thực bằng mật khẩu Admin."
      }
      busy={operation.busy}
      close={onClose}
      footer={
        <>
          <LoadingButton
            type="button"
            className="btn"
            disabled={operation.busy}
            loading={!!operation.busy}
            onClick={onClose}
          >
            Hủy
          </LoadingButton>
          <LoadingButton
            type="submit"
            form={formId}
            className={`btn ${mode === "delete" ? "btn-danger" : "btn-primary"}`}
            disabled={reason.trim().length < 3 || !password}
            loading={!!operation.busy}
          >
            {submitLabel()}
          </LoadingButton>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void operation.run(async () => {
            const scheduleValue =
              mode === "approve" && scheduleMode === "later" ? effectiveAt : "";
            if (mode === "approve" && scheduleMode === "later") {
              if (!scheduleValue) {
                throw new Error("Vui lòng chọn thời điểm áp dụng.");
              }
              if (new Date(scheduleValue).getTime() <= Date.now()) {
                throw new Error(
                  "Chọn thời điểm trong tương lai hoặc chuyển sang Áp dụng ngay.",
                );
              }
            }

            const feeBps = Math.round(Number(feePercent) * 100);
            if (
              ["create", "edit"].includes(mode) &&
              (!/^\d+(?:\.\d{1,2})?$/.test(feePercent) ||
                feeBps < 100 ||
                feeBps > 1000)
            ) {
              throw new Error("Mức phí phải từ 1% đến 10%.");
            }

            const auth = await api<{ reauthToken: string }>("reauthenticate", {
              method: "POST",
              body: { password, purpose: "STAFF_ROLE_CHANGE" },
            });
            setPassword("");

            const body = {
              reason: reason.trim(),
              reauthToken: auth.data.reauthToken,
            };

            if (mode === "create") {
              const versionNo = version ?? nextVersion;
              if (!versionNo) {
                throw new Error(
                  "Chưa tải được phiên bản kế tiếp. Vui lòng thử lại.",
                );
              }
              await api("fee-policies", {
                method: "POST",
                body: {
                  ...body,
                  policyCode,
                  versionNo,
                  feeBps,
                },
              });
              await nextVersionResource.reload();
              await onCompleted(
                `Đã tạo bản nháp ${financeLabel(policyCode)} v${versionNo} (${feeBps / 100}%).`,
              );
            } else if (mode === "approve" && selected) {
              await api(`fee-policies/${selected.id}/approve`, {
                method: "POST",
                body: {
                  ...body,
                  ...(scheduleValue
                    ? { effectiveAt: new Date(scheduleValue).toISOString() }
                    : {}),
                },
              });
              await onCompleted(
                `Đã phê duyệt ${financeLabel(selected.policyCode)} v${selected.versionNo}.`,
              );
            } else if (mode === "edit" && selected) {
              await api(`fee-policies/${selected.id}`, {
                method: "PATCH",
                body: { ...body, feeBps },
              });
              await onCompleted(
                `Đã cập nhật bản nháp ${financeLabel(selected.policyCode)} v${selected.versionNo} thành ${feeBps / 100}%.`,
              );
            } else if (mode === "delete" && selected) {
              await api(`fee-policies/${selected.id}`, {
                method: "DELETE",
                body,
              });
              await onCompleted(
                `Đã xóa bản nháp ${financeLabel(selected.policyCode)} v${selected.versionNo}.`,
              );
            }
          });
        }}
      >
        <fieldset className={styles.drawerForm} disabled={operation.busy}>
          {mode === "create" && (
            <div className={styles.drawerFieldGrid}>
              <label
                className={`${styles.drawerField} ${styles.drawerFieldFull}`}
              >
                <span>Phạm vi áp dụng</span>
                <select
                  value={policyCode}
                  onChange={(e) => {
                    setPolicyCode(e.target.value as FeePolicyCode);
                    setVersion(undefined);
                  }}
                >
                  {feePolicyCodes.map((code) => (
                    <option value={code} key={code}>
                      {financeLabel(code)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.drawerField}>
                <span>Số phiên bản</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={version ?? nextVersion ?? ""}
                  onChange={(e) =>
                    setVersion(
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                />
                <small className={styles.fieldHint}>
                  Tự động gợi ý phiên bản kế tiếp từ hệ thống.
                </small>
              </label>

              <label className={styles.drawerField}>
                <span>Mức phí nền tảng (%)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.01}
                  required
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                />
                <small className={styles.fieldHint}>
                  Giới hạn hợp lệ: từ 1% đến 10%.
                </small>
              </label>
            </div>
          )}

          {mode === "edit" && (
            <label className={styles.drawerField}>
              <span>Mức phí nền tảng (%)</span>
              <input
                type="number"
                min={1}
                max={10}
                step={0.01}
                required
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
              />
              <small className={styles.fieldHint}>
                Giới hạn hợp lệ: từ 1% đến 10% (tối đa 2 chữ số thập phân).
              </small>
            </label>
          )}

          {(mode === "create" || mode === "edit") &&
            receiverPreview !== null && (
              <div className={styles.feePreviewBox} role="status">
                <span>Phí nền tảng: {parsedFeeNum}%</span>
                <span>
                  {policyCode.startsWith("MATERIAL_PAID")
                    ? `Tác giả nhận: ${receiverPreview}%`
                    : `Hoàn/trả người tham gia: ${receiverPreview}%`}
                </span>
              </div>
            )}

          {mode === "approve" && selected && (
            <>
              <div className={styles.drawerHero}>
                <div className={styles.drawerHeroTop}>
                  <span className={styles.drawerHeroEyebrow}>
                    {financeLabel(selected.policyCode)}
                  </span>
                  <Badge tone="warn">Phiên bản {selected.versionNo}</Badge>
                </div>
                <strong className={styles.drawerHeroValue}>
                  Phí{" "}
                  {feeBpsOf(selected) !== null
                    ? `${feeBpsOf(selected)! / 100}%`
                    : "—"}
                </strong>
                <div className={styles.drawerHeroSub}>
                  <span>
                    {feeSplitText(selected.policyCode, feeBpsOf(selected))}
                  </span>
                </div>
              </div>

              <div className={styles.drawerField}>
                <span>Thời điểm có hiệu lực</span>
                <div className={styles.scheduleToggleRow}>
                  <button
                    type="button"
                    className={
                      scheduleMode === "now"
                        ? `${styles.scheduleChoice} ${styles.scheduleChoiceActive}`
                        : styles.scheduleChoice
                    }
                    onClick={() => setScheduleMode("now")}
                  >
                    <strong>Áp dụng ngay</strong>
                    <small>Có hiệu lực ngay khi hoàn tất phê duyệt.</small>
                  </button>
                  <button
                    type="button"
                    className={
                      scheduleMode === "later"
                        ? `${styles.scheduleChoice} ${styles.scheduleChoiceActive}`
                        : styles.scheduleChoice
                    }
                    onClick={() => setScheduleMode("later")}
                  >
                    <strong>Hẹn giờ hiệu lực</strong>
                    <small>
                      Chọn thời điểm tự động áp dụng trong tương lai.
                    </small>
                  </button>
                </div>
              </div>

              {scheduleMode === "later" && (
                <label className={styles.drawerField}>
                  <span>Thời điểm áp dụng</span>
                  <input
                    type="datetime-local"
                    required
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {mode === "delete" && (
            <AdminNotice tone="warn">
              <strong>Xác nhận xóa bản nháp</strong>
              <p>
                Bản nháp bị xóa sẽ không có hiệu lực. Số phiên bản này có thể
                được tạo lại nếu chưa có phiên bản mới hơn.
              </p>
            </AdminNotice>
          )}

          <label className={styles.drawerField}>
            <span>Lý do thay đổi *</span>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              placeholder="Ghi rõ lý do để lưu vào nhật ký kiểm toán…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <small className={styles.fieldHint}>
              {reason.trim().length}/1000 ký tự (tối thiểu 3 ký tự).
            </small>
          </label>

          <label className={styles.drawerField}>
            <span>Xác thực mật khẩu Admin *</span>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại của bạn…"
            />
          </label>

          {operation.feedback}
        </fieldset>
      </form>
    </AdminDrawer>
  );
}

/* ==========================================================================
   Fee Revenue Report Section (Doanh thu phí)
   ========================================================================== */

const presetButtons: readonly { id: RevenuePreset; label: string }[] = [
  { id: "7d", label: "7 ngày qua" },
  { id: "30d", label: "30 ngày qua" },
  { id: "thisMonth", label: "Tháng này" },
  { id: "90d", label: "90 ngày qua" },
];

function RevenueScreen({ vndPerCredit }: Readonly<{ vndPerCredit?: number }>) {
  const [range, setRange] = useState("");
  const [revision, setRevision] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState("day");
  const [activePreset, setActivePreset] = useState<RevenuePreset | null>(null);
  const [error, setError] = useState("");

  function runReport(
    nextFrom: string,
    nextTo: string,
    nextGranularity: string,
  ) {
    try {
      const query = feeRevenueQuery(nextFrom, nextTo, nextGranularity);
      setError("");
      setRange(query);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Kiểm tra lại khoảng ngày.",
      );
    }
  }

  function applyPreset(preset: RevenuePreset) {
    const next = utcDatePresetRange(preset);
    setFrom(next.from);
    setTo(next.to);
    setGranularity(next.granularity);
    setActivePreset(preset);
    runReport(next.from, next.to, next.granularity);
  }

  return (
    <section className={styles.sectionCard} aria-label="Báo cáo doanh thu phí">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <h2>Doanh thu phí nền tảng</h2>
          <p>
            Xem phí đã thu, phí đã hoàn và doanh thu thuần theo ngày hoặc tháng.
            Kỳ báo cáo tính theo múi giờ UTC, tối đa 366 ngày mỗi lần tra cứu.
          </p>
        </div>
      </div>

      <div className={styles.revenuePresets}>
        <span className={styles.revenuePresetsLabel}>Chọn nhanh:</span>
        {presetButtons.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={
                active
                  ? `${styles.filterChip} ${styles.filterChipActive}`
                  : styles.filterChip
              }
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <form
        className={styles.revenueForm}
        onSubmit={(e) => {
          e.preventDefault();
          setActivePreset(null);
          runReport(from, to, granularity);
        }}
      >
        <label className={styles.quickField}>
          <span>Từ ngày (UTC)</span>
          <input
            type="date"
            required
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset(null);
            }}
          />
        </label>
        <label className={styles.quickField}>
          <span>Đến ngày (UTC)</span>
          <input
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset(null);
            }}
          />
        </label>
        <label className={styles.quickField}>
          <span>Nhóm báo cáo theo</span>
          <select
            value={granularity}
            onChange={(e) => {
              setGranularity(e.target.value);
              setActivePreset(null);
            }}
          >
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          <Icon name="calendar" size={15} />
          Xem báo cáo
        </button>
      </form>

      {error && (
        <p role="alert" className={`staff-error ${styles.inlineError}`}>
          {error}
        </p>
      )}

      {range ? (
        <RevenueResult
          key={`${range}:${revision}`}
          query={range}
          vndPerCredit={vndPerCredit}
        />
      ) : (
        <div className={styles.walletEmpty}>
          <span className={styles.walletEmptyIcon} aria-hidden="true">
            <Icon name="calendar" size={22} />
          </span>
          <strong>Chọn khoảng ngày để xem báo cáo doanh thu</strong>
          <p>
            Nhấn một mốc Chọn nhanh ở trên (ví dụ 7 ngày qua, 30 ngày qua) hoặc
            tự chọn ngày bắt đầu và kết thúc để xem tổng phí đã thu và đã hoàn.
          </p>
        </div>
      )}
    </section>
  );
}

function RevenueResult({
  query,
  vndPerCredit,
}: Readonly<{ query: string; vndPerCredit?: number }>) {
  const resource = useStaffResource<Revenue>(`fee-revenue?${query}`);
  const items = resource.data?.items ?? [];

  const totalCollected = sumCreditStrings(items.map((r) => r.collectedCredit));
  const totalRefunded = sumCreditStrings(items.map((r) => r.refundedCredit));
  const totalNet = sumCreditStrings(items.map((r) => r.netCredit));
  const netVnd = vndPerCredit
    ? creditToVndEstimate(totalNet, vndPerCredit)
    : null;

  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!resource.data}
      reload={resource.reload}
    >
      {items.length > 0 ? (
        <>
          <div className={styles.revenueKpiStrip}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Tổng phí đã thu</span>
              <strong className={styles.kpiValue}>
                {financeNumber(totalCollected)} CR
              </strong>
              <span className={styles.kpiSub}>
                {items.length} dòng tổng hợp
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Tổng phí đã hoàn</span>
              <strong
                className={
                  creditDirection(totalRefunded) === "positive"
                    ? `${styles.kpiValue} ${styles.kpiValueWarn}`
                    : styles.kpiValue
                }
              >
                {financeNumber(totalRefunded)} CR
              </strong>
              <span className={styles.kpiSub}>Hoàn phí do hoàn tiền</span>
            </div>
            <div className={`${styles.kpiCard} ${styles.kpiCardBrand}`}>
              <span className={styles.kpiLabel}>Doanh thu thuần</span>
              <strong className={`${styles.kpiValue} ${styles.kpiValueBrand}`}>
                {financeNumber(totalNet)} CR
              </strong>
              <span className={styles.kpiSub}>
                {netVnd ? `≈ ${netVnd}` : "Phí thu − Phí hoàn"}
              </span>
            </div>
          </div>

          <div className={styles.revenueNote}>
            Kỳ báo cáo theo múi giờ {resource.data?.timezone ?? "UTC"}. Doanh
            thu thuần = Phí đã thu − Phí đã hoàn.
          </div>

          {/* Desktop Table */}
          <div className={styles.desktopTableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th scope="col">Kỳ</th>
                  <th scope="col">Nghiệp vụ</th>
                  <th scope="col" className={styles.numHead}>
                    Phí thu (CR)
                  </th>
                  <th scope="col" className={styles.numHead}>
                    Phí hoàn (CR)
                  </th>
                  <th scope="col" className={styles.numHead}>
                    Thuần (CR)
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={`${r.period}:${r.business}`}>
                    <td>
                      <strong>{r.period}</strong>
                    </td>
                    <td>{financeLabel(r.business)}</td>
                    <td className={styles.numCell}>
                      {financeNumber(r.collectedCredit)} CR
                    </td>
                    <td className={styles.numCell}>
                      <span
                        className={
                          creditDirection(r.refundedCredit) === "positive"
                            ? styles.deltaNegative
                            : styles.deltaZero
                        }
                      >
                        {financeNumber(r.refundedCredit)} CR
                      </span>
                    </td>
                    <td className={styles.numCell}>
                      <span
                        className={
                          creditDirection(r.netCredit) === "positive"
                            ? styles.deltaPositive
                            : styles.amountPrimary
                        }
                      >
                        {financeNumber(r.netCredit)} CR
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablet & Mobile Cards */}
          <div className={styles.mobileCards}>
            {items.map((r) => (
              <article
                key={`${r.period}:${r.business}`}
                className={styles.itemCard}
              >
                <div className={styles.itemCardHead}>
                  <div className={styles.itemCardTitle}>
                    <strong>{financeLabel(r.business)}</strong>
                    <span className={styles.metaText}>{r.period}</span>
                  </div>
                  <div className={styles.itemCardAmount}>
                    <span
                      className={
                        creditDirection(r.netCredit) === "positive"
                          ? styles.deltaPositive
                          : styles.amountPrimary
                      }
                    >
                      {financeNumber(r.netCredit)} CR
                    </span>
                    <span className={styles.metaText}>Thuần</span>
                  </div>
                </div>
                <div className={styles.itemCardMetrics}>
                  <div className={styles.itemCardMetricCol}>
                    <span className={styles.itemCardMetricLabel}>Phí thu</span>
                    <strong>{financeNumber(r.collectedCredit)} CR</strong>
                  </div>
                  <div className={styles.itemCardMetricCol}>
                    <span className={styles.itemCardMetricLabel}>Phí hoàn</span>
                    <strong>{financeNumber(r.refundedCredit)} CR</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="Chưa có doanh thu trong kỳ"
          desc="Không ghi nhận phí nền tảng nào trong khoảng thời gian đã chọn. Hãy thử chọn khoảng ngày khác."
        />
      )}
    </QueueState>
  );
}
