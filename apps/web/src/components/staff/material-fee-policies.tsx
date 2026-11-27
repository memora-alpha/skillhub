"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
import { useState } from "react";
import { Card, Empty, StatusBadge } from "@/components/console/ui";
import { PasswordInput } from "@/components/password-input";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { QueueState } from "./common";
import { useOperation } from "./operation-tools";
import { fmtDateTime } from "@/lib/console/format";
import {
  feeRevenueQuery,
  financeLabel,
  financeNumber,
} from "@/lib/staff/finance-presentation";
import styles from "./operations.module.css";
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
export function MaterialFeePolicies() {
  const { api } = useStaffSession();
  const list = useStaffListPages<Fee>("fee-policies?limit=20");
  const operation = useOperation();
  const [mode, setMode] = useState<"create" | "approve" | "edit" | "delete">(
    "create",
  );
  const [selected, setSelected] = useState<Fee>();
  const [policyCode, setPolicyCode] = useState<FeePolicyCode>("MATERIAL_PAID");
  const nextVersionResource = useStaffResource<{
    policyCode: FeePolicyCode;
    nextVersion: number;
  }>(`fee-policies/next-version?${new URLSearchParams({ policyCode })}`, {
    retainOnReload: true,
  });
  const [version, setVersion] = useState<number>();
  const nextVersion = nextVersionResource.data?.nextVersion;
  const [feePercent, setFeePercent] = useState("5");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  function resetSelection() {
    setMode("create");
    setSelected(undefined);
    setVersion(undefined);
    setReason("");
    setPassword("");
    setEffectiveAt("");
  }
  function selectDraft(fee: Fee, action: "approve" | "edit" | "delete") {
    setSelected(fee);
    setMode(action);
    if (feePolicyCodes.includes(fee.policyCode as FeePolicyCode))
      setPolicyCode(fee.policyCode as FeePolicyCode);
    if (action === "edit" && typeof fee.calculationRule.feeBps === "number")
      setFeePercent(String(fee.calculationRule.feeBps / 100));
    setPassword("");
    setReason("");
    setEffectiveAt("");
  }
  function saveLabel() {
    if (operation.busy) {
      return "Đang lưu…";
    }
    if (mode === "create") return "Tạo bản nháp";
    if (mode === "edit") return "Lưu bản nháp";
    if (mode === "delete") return "Xóa bản nháp";
    return "Duyệt phiên bản";
  }
  function selectionLabel() {
    if (mode === "approve") return "Duyệt";
    if (mode === "edit") return "Sửa";
    return "Xóa";
  }
  return (
    <div className={styles.workspace}>
      <Card title="Chính sách phí">
        <p className={styles.hint}>
          Theo dõi mức phí và thời điểm áp dụng. Mọi thay đổi phí học tập hoặc
          tài liệu đều tạo bản nháp, xác thực lại và phê duyệt trước khi có hiệu
          lực. Thỏa thuận đã khóa tiếp tục dùng phiên bản phí đã chốt.
        </p>
        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
        >
          <div className="table-wrap">
            <table className={`table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Phạm vi / phiên bản</th>
                  <th>Phí</th>
                  <th>Trạng thái</th>
                  <th>Hiệu lực từ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((f) => {
                  function feeRateLabel() {
                    if (typeof f.calculationRule.feeBps === "number") {
                      return `${f.calculationRule.feeBps / 100}%`;
                    }
                    if (typeof f.calculationRule.platformFeeBps === "number") {
                      return `${f.calculationRule.platformFeeBps / 100}%`;
                    }
                    return "Theo chính sách";
                  }
                  return (
                    <tr key={f.id}>
                      <td data-label="Phạm vi / phiên bản">
                        <strong>{financeLabel(f.policyCode)}</strong>
                        <small>Phiên bản {f.versionNo}</small>
                      </td>
                      <td data-label="Mức phí">{feeRateLabel()}</td>
                      <td data-label="Trạng thái">
                        {f.effective ? (
                          <span className="badge badge-ok">Đang áp dụng</span>
                        ) : (
                          <StatusBadge status={f.status} />
                        )}
                      </td>
                      <td data-label="Hiệu lực từ">
                        {f.effectiveAt
                          ? fmtDateTime(f.effectiveAt)
                          : "Chưa lên lịch"}
                      </td>
                      <td data-label="Thao tác">
                        {f.status === "DRAFT" && (
                          <div className="row">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => selectDraft(f, "approve")}
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => selectDraft(f, "edit")}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => selectDraft(f, "delete")}
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueueState>
        <ListPagination query={list} />
        <details
          className={styles.technical}
          open={mode !== "create" || undefined}
        >
          <summary>
            {mode === "create"
              ? "Tạo phiên bản chính sách phí"
              : `${selectionLabel()} ${financeLabel(selected?.policyCode ?? policyCode)} v${selected?.versionNo ?? "—"}`}
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operation.run(async () => {
                if (
                  mode === "approve" &&
                  effectiveAt &&
                  new Date(effectiveAt).getTime() <= Date.now()
                )
                  throw new Error(
                    "Chọn thời điểm trong tương lai hoặc để trống để áp dụng ngay.",
                  );
                const auth = await api<{ reauthToken: string }>(
                  "reauthenticate",
                  {
                    method: "POST",
                    body: { password, purpose: "STAFF_ROLE_CHANGE" },
                  },
                );
                setPassword("");
                const body = {
                  reason: reason.trim(),
                  reauthToken: auth.data.reauthToken,
                };
                const feeBps = Math.round(Number(feePercent) * 100);
                if (
                  ["create", "edit"].includes(mode) &&
                  (!/^\d+(?:\.\d{1,2})?$/.test(feePercent) ||
                    feeBps < 100 ||
                    feeBps > 1000)
                )
                  throw new Error("Mức phí phải từ 1% đến 10%.");
                if (mode === "create") {
                  const versionNo = version ?? nextVersion;
                  if (!versionNo)
                    throw new Error(
                      "Chưa tải được phiên bản kế tiếp. Vui lòng thử lại.",
                    );
                  await api("fee-policies", {
                    method: "POST",
                    body: {
                      ...body,
                      policyCode,
                      versionNo,
                      feeBps,
                    },
                  });
                } else if (mode === "approve" && selected) {
                  await api(`fee-policies/${selected.id}/approve`, {
                    method: "POST",
                    body: {
                      ...body,
                      ...(effectiveAt
                        ? { effectiveAt: new Date(effectiveAt).toISOString() }
                        : {}),
                    },
                  });
                } else if (mode === "edit" && selected) {
                  await api(`fee-policies/${selected.id}`, {
                    method: "PATCH",
                    body: { ...body, feeBps },
                  });
                } else if (mode === "delete" && selected) {
                  await api(`fee-policies/${selected.id}`, {
                    method: "DELETE",
                    body,
                  });
                }
                await list.reload();
                await nextVersionResource.reload();
                resetSelection();
              });
            }}
          >
            <fieldset className={styles.form} disabled={operation.busy}>
              {mode === "create" ? (
                <>
                  <label>
                    <span>Phạm vi áp dụng</span>
                    <select
                      className="select"
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
                  <label>
                    <span>Phiên bản</span>
                    <input
                      className="input"
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
                  </label>
                  <label>
                    <span>Mức phí (%)</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      step={0.01}
                      required
                      value={feePercent}
                      onChange={(e) => setFeePercent(e.target.value)}
                    />
                  </label>
                </>
              ) : mode === "approve" ? (
                <label>
                  <span>Hiệu lực từ (để trống: ngay khi duyệt)</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                </label>
              ) : mode === "edit" ? (
                <label>
                  <span>Mức phí (%)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10}
                    step={0.01}
                    required
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                  />
                </label>
              ) : (
                <p className={styles.hint}>
                  Bản nháp bị xóa sẽ không có hiệu lực và phiên bản đó có thể
                  được tạo lại nếu chưa có phiên bản mới hơn.
                </p>
              )}
              <label>
                <span>Lý do</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label>
                <span>Mật khẩu Admin</span>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <div className="row">
                <LoadingButton
                  type="submit"
                  className="btn btn-primary"
                  disabled={reason.trim().length < 3}
                  loading={!!operation.busy}
                >
                  {saveLabel()}
                </LoadingButton>
                {mode !== "create" && (
                  <LoadingButton
                    className="btn"
                    type="button"
                    onClick={resetSelection}
                    loading={!!operation.busy}
                  >
                    Hủy chọn
                  </LoadingButton>
                )}
              </div>
            </fieldset>
          </form>
          {operation.feedback}
        </details>
      </Card>
      <RevenueScreen />
    </div>
  );
}
function RevenueScreen() {
  const [range, setRange] = useState("");
  const [revision, setRevision] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState("day");
  const [error, setError] = useState("");
  return (
    <Card title="Doanh thu phí">
      <p className={styles.hint}>
        Chọn khoảng ngày, tối đa 366 ngày. Kỳ báo cáo được tính theo UTC.
      </p>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const query = feeRevenueQuery(from, to, granularity);
            setError("");
            setRange(query);
            setRevision((value) => value + 1);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Kiểm tra lại khoảng ngày.",
            );
          }
        }}
      >
        <label>
          <span>Từ ngày</span>
          <input
            className="input"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            className="input"
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          <span>Nhóm theo</span>
          <select
            className="select"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
          >
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Xem báo cáo
        </button>
      </form>
      {error && (
        <p role="alert" className="staff-error">
          {error}
        </p>
      )}
      {range ? (
        <RevenueResult key={`${range}:${revision}`} query={range} />
      ) : (
        <div className={styles.lookupEmpty}>
          <strong>Xem phí đã thu và đã hoàn</strong>Chọn khoảng ngày để xem
          doanh thu thực tế.
        </div>
      )}
    </Card>
  );
}
function RevenueResult({ query }: Readonly<{ query: string }>) {
  const resource = useStaffResource<Revenue>(`fee-revenue?${query}`);
  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!resource.data}
      reload={resource.reload}
    >
      <p className={styles.hint}>
        Kỳ báo cáo theo {resource.data?.timezone ?? "UTC"}. Thuần = phí thu −
        phí hoàn.
      </p>
      <div className="table-wrap">
        <table className={`table ${styles.table}`}>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Nghiệp vụ</th>
              <th>Thu</th>
              <th>Hoàn</th>
              <th>Thuần (CR)</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((r) => (
              <tr key={`${r.period}:${r.business}`}>
                <td data-label="Kỳ">{r.period}</td>
                <td data-label="Nghiệp vụ">{financeLabel(r.business)}</td>
                <td data-label="Phí thu (CR)">
                  {financeNumber(r.collectedCredit)}
                </td>
                <td data-label="Phí hoàn (CR)">
                  {financeNumber(r.refundedCredit)}
                </td>
                <td data-label="Thuần (CR)">
                  <span className={styles.money}>
                    {financeNumber(r.netCredit)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resource.data?.items.length === 0 && (
        <Empty
          title="Chưa có doanh thu trong kỳ"
          desc="Thử chọn khoảng ngày khác."
        />
      )}
    </QueueState>
  );
}
