"use client";
import { useState } from "react";
import { Card } from "@/components/console/ui";
import { PasswordInput } from "@/components/password-input";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { Pager, QueueState } from "./common";
import { useOperation } from "./operation-tools";
import { fmtDateTime } from "@/lib/console/format";
type Fee = {
  id: string;
  policyCode: string;
  versionNo: number;
  status: string;
  effective: boolean;
  effectiveAt: string | null;
  calculationRule: { feeBps?: number; platformFeeBps?: number };
};
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
  const list = useStaffList<Fee>("fee-policies?limit=20");
  const operation = useOperation();
  const [mode, setMode] = useState("create");
  const [version, setVersion] = useState(1);
  const [bps, setBps] = useState(500);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  return (
    <>
      <Card>
        <h2>Chính sách phí</h2>
        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
        >
          <div className="table-wrap">
            <table>
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
                {list.items.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.policyCode} · v{f.versionNo}
                    </td>
                    <td>
                      {typeof f.calculationRule.feeBps === "number"
                        ? `${f.calculationRule.feeBps / 100}%`
                        : typeof f.calculationRule.platformFeeBps === "number"
                          ? `${f.calculationRule.platformFeeBps / 100}%`
                          : "Theo chính sách"}
                    </td>
                    <td>{f.effective ? "Đang áp dụng" : f.status}</td>
                    <td>
                      {f.effectiveAt
                        ? fmtDateTime(f.effectiveAt)
                        : "Chưa áp dụng"}
                    </td>
                    <td>
                      {f.policyCode === "MATERIAL_PAID" &&
                        f.status === "DRAFT" && (
                          <button className="btn" onClick={() => setMode(f.id)}>
                            Chọn để duyệt
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueueState>
        <Pager
          loading={list.loading}
          hasMore={list.page?.hasMore}
          more={list.more}
        />
        <details>
          <summary>
            {mode === "create"
              ? "Tạo phiên bản phí tài liệu"
              : "Duyệt phiên bản đã chọn"}
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operation.run(async () => {
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
                if (mode === "create")
                  await api("fee-policies/material", {
                    method: "POST",
                    body: { ...body, versionNo: version, feeBps: bps },
                  });
                else
                  await api(`fee-policies/${mode}/approve`, {
                    method: "POST",
                    body: {
                      ...body,
                      ...(effectiveAt
                        ? { effectiveAt: new Date(effectiveAt).toISOString() }
                        : {}),
                    },
                  });
                await list.reload();
                setMode("create");
              });
            }}
          >
            <fieldset disabled={operation.busy}>
              {mode === "create" ? (
                <>
                  <label>
                    Phiên bản
                    <input
                      className="input"
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={version}
                      onChange={(e) => setVersion(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Phí (điểm cơ bản, 500 = 5%)
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={9999}
                      step={1}
                      required
                      value={bps}
                      onChange={(e) => setBps(Number(e.target.value))}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Hiệu lực từ (để trống: ngay khi duyệt)
                  <input
                    className="input"
                    type="datetime-local"
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                  />
                </label>
              )}
              <label>
                Lý do
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label>
                Mật khẩu Admin
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <div className="row">
                <button
                  className="btn btn-primary"
                  disabled={reason.trim().length < 3}
                >
                  Xác nhận
                </button>
                {mode !== "create" && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setMode("create")}
                  >
                    Hủy chọn
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {operation.feedback}
        </details>
      </Card>
      <RevenueScreen />
    </>
  );
}
function RevenueScreen() {
  const [range, setRange] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState("day");
  return (
    <Card>
      <h2>Doanh thu phí</h2>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams({
            from: new Date(`${from}T00:00:00`).toISOString(),
            to: new Date(`${to}T23:59:59.999`).toISOString(),
            granularity,
          });
          setRange(params.toString());
        }}
      >
        <label>
          Từ ngày
          <input
            className="input"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Đến ngày
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
          Nhóm theo
          <select
            className="select"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
          >
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
          </select>
        </label>
        <button className="btn">Xem báo cáo</button>
      </form>
      {range && <RevenueResult key={range} query={range} />}
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
      <p className="muted">Kỳ báo cáo theo UTC.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Nghiệp vụ</th>
              <th>Thu</th>
              <th>Hoàn</th>
              <th>Ròng (CR)</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((r, i) => (
              <tr key={i}>
                <td>{r.period}</td>
                <td>{r.business}</td>
                <td>{r.collectedCredit}</td>
                <td>{r.refundedCredit}</td>
                <td>{r.netCredit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resource.data?.items.length === 0 && <p>Chưa có doanh thu trong kỳ.</p>}
    </QueueState>
  );
}
