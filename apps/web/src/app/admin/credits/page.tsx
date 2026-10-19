"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import {
  Card,
  Empty,
  GatedButton,
  Notice,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import {
  LEDGER,
  PAYMENTS,
  userName,
  type LedgerEntry,
} from "@/lib/console/data";
import { fmtCredit, fmtDateTime, fmtNum, fmtVnd } from "@/lib/console/format";

type Tab = "LEDGER" | "PAYMENTS" | "ADJUST";
const MAX_ADJUST = 10_000;

export default function AdminCreditsPage() {
  const { users, updateUser, can, record } = useConsole();
  const [tab, setTab] = useState<Tab>("LEDGER");
  const [ledger, setLedger] = useState<LedgerEntry[]>(LEDGER);
  const [type, setType] = useState("");
  const [userId, setUserId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    userId: string;
    amount: number;
  } | null>(null);

  const types = [...new Set(ledger.map((l) => l.type))];
  const rows = ledger.filter((l) => !type || l.type === type);
  const user = users.find((u) => u.id === userId);
  const amount = Number(amountText);
  const valid = Number.isInteger(amount) && amount !== 0;

  function review() {
    if (!user) return setError("Chọn người dùng cần điều chỉnh.");
    if (!valid)
      return setError("Số Credit phải là số nguyên khác 0 (âm để trừ).");
    if (Math.abs(amount) > MAX_ADJUST)
      return setError(
        `Mỗi lần điều chỉnh tối đa ${fmtNum(MAX_ADJUST)} Credit.`,
      );
    if (user.credit + amount < 0)
      return setError("Số dư sau điều chỉnh không được âm.");
    setError(null);
    setConfirming({ userId: user.id, amount });
  }

  function apply(reason: string) {
    if (!confirming) return;
    const target = users.find((u) => u.id === confirming.userId);
    if (!target) return;
    const next = target.credit + confirming.amount;
    updateUser(target.id, { credit: next });
    setLedger((p) => [
      {
        id: `tx_${9100 + p.length}`,
        at: new Date().toISOString(),
        userId: target.id,
        type: "ADJUSTMENT",
        amount: confirming.amount,
        status: "SUCCESS",
        ref: "SYSTEM",
        note: reason,
      },
      ...p,
    ]);
    record({
      action: "CREDIT_ADJUST",
      target: `USER:${target.id}`,
      reason,
      before: String(target.credit),
      after: String(next),
    });
    setConfirming(null);
    setAmountText("");
    setUserId("");
    setTab("LEDGER");
  }

  return (
    <>
      <PageHeader
        title="Credit & giao dịch"
        desc="Tra cứu sổ cái, thanh toán và tạo điều chỉnh Credit. Hệ thống không hỗ trợ rút tiền mặt."
      />
      <div className="toolbar">
        <Segmented<Tab>
          label="Chế độ xem"
          value={tab}
          onChange={setTab}
          options={[
            { id: "LEDGER", label: "Sổ cái" },
            { id: "PAYMENTS", label: "Thanh toán nạp" },
            { id: "ADJUST", label: "Điều chỉnh" },
          ]}
        />
        {tab === "LEDGER" && (
          <label>
            <span className="sr-only">Lọc theo loại giao dịch</span>
            <select
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Mọi loại giao dịch</option>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {tab === "LEDGER" && (
        <Card flush>
          {rows.length === 0 ? (
            <Empty title="Chưa có giao dịch" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Thời gian</th>
                    <th>Người dùng</th>
                    <th>Loại</th>
                    <th className="num">Credit</th>
                    <th>Trạng thái</th>
                    <th>Tham chiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.id}</td>
                      <td className="muted">{fmtDateTime(l.at)}</td>
                      <td>{userName(l.userId)}</td>
                      <td className="mono">{l.type}</td>
                      <td className={`num ${l.amount > 0 ? "pos" : "neg"}`}>
                        {fmtCredit(l.amount)}
                      </td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td>
                        <span className="mono">{l.ref}</span>
                        {l.note && <div className="muted">{l.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-foot">
            Sổ cái chỉ ghi thêm; điều chỉnh sai được bù bằng bút toán mới, không
            sửa bút toán cũ.
          </div>
        </Card>
      )}

      {tab === "PAYMENTS" && (
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Thời gian</th>
                  <th>Người dùng</th>
                  <th className="num">Số tiền</th>
                  <th className="num">Credit</th>
                  <th>Cổng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {PAYMENTS.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td className="muted">{fmtDateTime(p.at)}</td>
                    <td>{userName(p.userId)}</td>
                    <td className="num">{fmtVnd(p.vnd)}</td>
                    <td className="num">{fmtNum(p.credit)}</td>
                    <td>{p.provider}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">Quy đổi cố định: 1.000 ₫ = 1 Credit.</div>
        </Card>
      )}

      {tab === "ADJUST" && (
        <div className="grid grid-main">
          <Card title="Tạo điều chỉnh Credit">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                review();
              }}
            >
              <div className="field">
                <label htmlFor="adj-user">Người dùng</label>
                <select
                  id="adj-user"
                  className="select"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">Chọn người dùng…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {fmtNum(u.credit)} Credit
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="adj-amount">
                  Số Credit (dương để cộng, âm để trừ)
                </label>
                <input
                  id="adj-amount"
                  className="input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ví dụ: 20 hoặc -15"
                  value={amountText}
                  aria-invalid={!!error}
                  onChange={(e) => setAmountText(e.target.value)}
                />
                <div className="hint">
                  {user && valid
                    ? `Số dư: ${fmtNum(user.credit)} → ${fmtNum(user.credit + amount)} Credit`
                    : `Tối đa ${fmtNum(MAX_ADJUST)} Credit mỗi lần.`}
                </div>
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-foot">
                <GatedButton
                  allowed={can("credit.adjust")}
                  className="btn btn-primary"
                  type="submit"
                >
                  <Icon name="check" size={16} /> Tiếp tục
                </GatedButton>
              </div>
            </form>
          </Card>
          <Notice tone="warn" icon="warn">
            Điều chỉnh thủ công <strong>bắt buộc có lý do</strong> và luôn được
            ghi Audit log (<span className="mono">CREDIT_ADJUST</span>). Không
            có chức năng rút tiền mặt.
          </Notice>
        </div>
      )}

      {confirming && (
        <ReasonDialog
          title="Xác nhận điều chỉnh Credit"
          description={`${userName(confirming.userId)}: ${fmtCredit(confirming.amount)} Credit`}
          confirmLabel="Xác nhận điều chỉnh"
          tone={confirming.amount < 0 ? "danger" : "primary"}
          help="Bắt buộc. Lý do hiển thị trong sổ cái và Audit log."
          onClose={() => setConfirming(null)}
          onConfirm={apply}
        />
      )}
    </>
  );
}
