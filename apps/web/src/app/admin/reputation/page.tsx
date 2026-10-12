"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import {
  Badge,
  Card,
  Empty,
  GatedButton,
  Notice,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { BADGES, REVIEWS, userName, type ReviewRow } from "@/lib/console/data";
import { fmtDateTime, fmtNum } from "@/lib/console/format";

type Tab = "REVIEWS" | "REPUTATION" | "BADGES";
const MAX_DELTA = 50;

export default function AdminReputationPage() {
  const { users, updateUser, can, record, audit } = useConsole();
  const [tab, setTab] = useState<Tab>("REVIEWS");
  const [reviews, setReviews] = useState<ReviewRow[]>(REVIEWS);
  const [hiding, setHiding] = useState<ReviewRow | null>(null);
  const [userId, setUserId] = useState("");
  const [deltaText, setDeltaText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    userId: string;
    delta: number;
  } | null>(null);

  const user = users.find((u) => u.id === userId);
  const delta = Number(deltaText);
  const valid = Number.isInteger(delta) && delta !== 0;
  const history = audit.filter((a) => a.action === "REPUTATION_ADJUST");

  function toggleReview(reason: string) {
    if (!hiding) return;
    const hide = !hiding.hidden;
    setReviews((p) =>
      p.map((r) => (r.id === hiding.id ? { ...r, hidden: hide } : r)),
    );
    record({
      action: hide ? "REVIEW_HIDE" : "REVIEW_RESTORE", // not in API AUDIT_ACTIONS yet
      target: `REVIEW:${hiding.id}`,
      reason,
      before: hide ? "VISIBLE" : "HIDDEN",
      after: hide ? "HIDDEN" : "VISIBLE",
    });
    setHiding(null);
  }

  function review() {
    if (!user) return setError("Chọn người dùng cần điều chỉnh.");
    if (!valid)
      return setError("Điểm điều chỉnh phải là số nguyên khác 0 (âm để trừ).");
    if (Math.abs(delta) > MAX_DELTA)
      return setError(`Mỗi lần điều chỉnh tối đa ${MAX_DELTA} điểm.`);
    if (user.reputation + delta < 0 || user.reputation + delta > 100)
      return setError(
        "Điểm uy tín sau điều chỉnh phải nằm trong khoảng 0–100.",
      );
    setError(null);
    setConfirming({ userId: user.id, delta });
  }

  function apply(reason: string) {
    if (!confirming) return;
    const target = users.find((u) => u.id === confirming.userId);
    if (!target) return;
    const next = target.reputation + confirming.delta;
    updateUser(target.id, { reputation: next });
    record({
      action: "REPUTATION_ADJUST",
      target: `USER:${target.id}`,
      reason,
      before: String(target.reputation),
      after: String(next),
    });
    setConfirming(null);
    setDeltaText("");
    setUserId("");
  }

  return (
    <>
      <PageHeader
        title="Đánh giá & uy tín"
        desc="Ẩn đánh giá vi phạm, điều chỉnh điểm uy tín đặc biệt và xem danh hiệu."
      />
      <div className="toolbar">
        <Segmented<Tab>
          label="Chế độ xem"
          value={tab}
          onChange={setTab}
          options={[
            {
              id: "REVIEWS",
              label: "Đánh giá",
              count: reviews.filter((r) => r.flagged && !r.hidden).length,
            },
            { id: "REPUTATION", label: "Điều chỉnh uy tín" },
            { id: "BADGES", label: "Danh hiệu" },
          ]}
        />
      </div>

      {tab === "REVIEWS" && (
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Đánh giá</th>
                  <th>Điểm</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th>
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{userName(r.authorId)}</strong>
                      <div className="muted">
                        → {userName(r.targetId)} · {fmtDateTime(r.at)}
                      </div>
                    </td>
                    <td>
                      <span aria-label={`${r.rating} trên 5 sao`}>
                        <Icon name="star" size={14} /> {r.rating}/5
                      </span>
                    </td>
                    <td className="cell-wrap">
                      {r.text}
                      {r.flagged && (
                        <div>
                          <Badge tone="warn">Bị gắn cờ</Badge>
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.hidden ? "HIDDEN" : "VISIBLE"} />
                    </td>
                    <td>
                      <GatedButton
                        allowed={can("review.hide")}
                        className="btn btn-sm"
                        aria-label={`${r.hidden ? "Khôi phục" : "Ẩn"} đánh giá ${r.id}`}
                        onClick={() => setHiding(r)}
                      >
                        <Icon
                          name={r.hidden ? "restore" : "eyeOff"}
                          size={14}
                        />
                        {r.hidden ? "Khôi phục" : "Ẩn"}
                      </GatedButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "REPUTATION" && (
        <div className="stack">
          <div className="grid grid-main">
            <Card title="Điều chỉnh điểm uy tín">
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  review();
                }}
              >
                <div className="field">
                  <label htmlFor="rep-user">Người dùng</label>
                  <select
                    id="rep-user"
                    className="select"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  >
                    <option value="">Chọn người dùng…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.reputation} điểm
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rep-delta">
                    Điểm điều chỉnh (dương để cộng, âm để trừ)
                  </label>
                  <input
                    id="rep-delta"
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ví dụ: 5 hoặc -10"
                    value={deltaText}
                    aria-invalid={!!error}
                    onChange={(e) => setDeltaText(e.target.value)}
                  />
                  <div className="hint">
                    {user && valid
                      ? `Điểm: ${user.reputation} → ${user.reputation + delta}`
                      : `Tối đa ${MAX_DELTA} điểm mỗi lần, kết quả trong khoảng 0–100.`}
                  </div>
                </div>
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="dialog-foot">
                  <GatedButton
                    allowed={can("reputation.adjust")}
                    className="btn btn-primary"
                    type="submit"
                  >
                    <Icon name="check" size={16} /> Tiếp tục
                  </GatedButton>
                </div>
              </form>
            </Card>
            <Notice tone="warn" icon="warn">
              Điều chỉnh uy tín là biện pháp đặc biệt:{" "}
              <strong>bắt buộc có lý do</strong> và được ghi Audit log. Điểm
              bình thường do chính sách backend tính tự động.
            </Notice>
          </div>
          <Card title="Lịch sử điều chỉnh" flush>
            {history.length === 0 ? (
              <Empty title="Chưa có điều chỉnh nào" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Đối tượng</th>
                      <th className="num">Điểm</th>
                      <th>Thực hiện bởi</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id}>
                        <td className="muted">{fmtDateTime(a.at)}</td>
                        <td className="mono">{a.target}</td>
                        <td className="num">
                          {a.before} → {a.after}
                        </td>
                        <td>{a.actor}</td>
                        <td className="cell-wrap">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "BADGES" && (
        <div className="grid grid-3">
          {BADGES.map((b) => (
            <Card key={b.code}>
              <div className="stack">
                <div className="row">
                  <Icon name="award" />
                  <strong>{b.name}</strong>
                </div>
                <span className="mono muted">{b.code}</span>
                <span>{b.desc}</span>
                <Badge tone="brand">
                  {fmtNum(b.holders)} người đang sở hữu
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hiding && (
        <ReasonDialog
          title={hiding.hidden ? "Khôi phục đánh giá" : "Ẩn đánh giá vi phạm"}
          description={`“${hiding.text}”`}
          confirmLabel={hiding.hidden ? "Khôi phục" : "Ẩn đánh giá"}
          tone={hiding.hidden ? "primary" : "danger"}
          onClose={() => setHiding(null)}
          onConfirm={toggleReview}
        />
      )}
      {confirming && (
        <ReasonDialog
          title="Xác nhận điều chỉnh uy tín"
          description={`${userName(confirming.userId)}: ${confirming.delta > 0 ? "+" : ""}${confirming.delta} điểm`}
          confirmLabel="Xác nhận điều chỉnh"
          tone={confirming.delta < 0 ? "danger" : "primary"}
          help="Bắt buộc. Lý do được ghi vào lịch sử uy tín và Audit log."
          onClose={() => setConfirming(null)}
          onConfirm={apply}
        />
      )}
    </>
  );
}
