"use client";
import { useState } from "react";
import { Badge, Card, PageHeader } from "@/components/console/ui";
import type { ModerationRules } from "@/lib/staff/admin-types";
import { fmtDateTime } from "@/lib/console/format";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
function RulesEditor({
  snapshot,
  reload,
  onSaved,
}: {
  snapshot: ModerationRules;
  reload: () => void;
  onSaved: () => void;
}) {
  const { api } = useStaffSession();
  const [rules, setRules] = useState(snapshot.rules);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = JSON.stringify(rules) !== JSON.stringify(snapshot.rules);
  function validate() {
    const pairs = new Set<string>();
    if (!rules.length || rules.length > 250) return "Cần từ 1 đến 250 quy tắc.";
    for (const r of rules) {
      const category = r.category.trim().toUpperCase();
      const pattern = r.pattern
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/gu, " ")
        .trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(category))
        return "Nhóm quy tắc bắt đầu bằng chữ, tối đa 64 ký tự; chỉ dùng chữ, số, dấu _ hoặc -.";
      if (
        pattern.length > 120 ||
        [...pattern].filter((c) => c !== "*").length < 2 ||
        [...pattern].filter((c) => c === "*").length > 1
      )
        return "Mẫu cần ít nhất 2 ký tự ngoài dấu *, tối đa 120 ký tự và tối đa một dấu *.";
      const key = `${category}\u0000${pattern}`;
      if (pairs.has(key)) return "Có quy tắc trùng nhóm và mẫu sau chuẩn hóa.";
      pairs.add(key);
    }
    return null;
  }
  return (
    <div className="stack">
      <div className="row">
        <Badge>Phiên bản {snapshot.version}</Badge>
        <span className="muted">Đọc lúc {fmtDateTime(snapshot.readAt)}</span>
      </div>
      <p className="muted">
        Nội dung khớp quy tắc sẽ được đưa vào hàng đợi kiểm duyệt. Dùng * để
        khớp một đoạn văn bản.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const issue = validate();
          setError(issue);
          if (!issue) setConfirm(true);
        }}
      >
        <fieldset className="portal-fields stack" disabled={confirm}>
          {rules.map((rule, i) => (
            <div className="portal-rule" key={i}>
              <label className="staff-field">
                Nhóm quy tắc
                <input
                  required
                  maxLength={64}
                  pattern="[A-Za-z][A-Za-z0-9_-]*"
                  value={rule.category}
                  onChange={(e) =>
                    setRules(
                      rules.map((r, j) =>
                        j === i ? { ...r, category: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <label className="staff-field">
                Mẫu nội dung
                <input
                  required
                  maxLength={120}
                  value={rule.pattern}
                  onChange={(e) =>
                    setRules(
                      rules.map((r, j) =>
                        j === i ? { ...r, pattern: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-sm"
                disabled={rules.length <= 1}
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
                aria-label={`Xóa quy tắc ${i + 1}`}
              >
                Xóa
              </button>
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="btn"
              disabled={rules.length >= 250}
              onClick={() =>
                setRules([...rules, { category: "", pattern: "" }])
              }
            >
              Thêm quy tắc
            </button>
            <button className="btn btn-primary" disabled={!changed}>
              Lưu thay đổi
            </button>
            <button
              type="button"
              className="btn"
              disabled={!changed}
              onClick={() => {
                setRules(snapshot.rules);
                setError(null);
              }}
            >
              Hoàn tác
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {confirm && (
        <DecisionDialog
          title="Lưu quy tắc kiểm duyệt"
          description={`${rules.length} quy tắc sẽ thay thế bộ quy tắc hiện tại.`}
          min={10}
          max={500}
          confirmLabel="Lưu quy tắc"
          onClose={() => setConfirm(false)}
          onReload={reload}
          onSubmit={async (reason) => {
            await api<ModerationRules>("moderation-rules", {
              method: "PUT",
              body: { expectedVersion: snapshot.version, rules, reason },
            });
            onSaved();
          }}
        />
      )}
    </div>
  );
}
export function RulesScreen() {
  const [success, setSuccess] = useState(false);
  const resource = useStaffResource<ModerationRules>("moderation-rules");
  return (
    <>
      <PageHeader
        title="Quy tắc kiểm duyệt"
        desc="Cấu hình phát hiện nội dung cần xem xét trong yêu cầu học."
        actions={
          <button
            className="btn"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Làm mới
          </button>
        }
      />
      {success && (
        <p className="staff-success" role="status">
          Đã lưu quy tắc kiểm duyệt.
        </p>
      )}
      <Card>
        <QueueState
          loading={resource.loading}
          error={resource.error}
          empty={!resource.data}
          reload={resource.reload}
        >
          {resource.data && (
            <RulesEditor
              key={resource.data.version}
              snapshot={resource.data}
              reload={resource.reload}
              onSaved={() => {
                setSuccess(true);
                void resource.reload();
              }}
            />
          )}
        </QueueState>
      </Card>
    </>
  );
}
