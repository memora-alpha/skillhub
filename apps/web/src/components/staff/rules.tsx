"use client";
import { useState } from "react";
import {
  editableRules,
  ruleValues,
  validateRules,
} from "@/lib/staff/moderation-rules";
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
}: Readonly<{
  snapshot: ModerationRules;
  reload: () => void;
  onSaved: () => void;
}>) {
  const { api } = useStaffSession();
  const [rules, setRules] = useState(() => editableRules(snapshot.rules));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed =
    JSON.stringify(ruleValues(rules)) !== JSON.stringify(snapshot.rules);
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
          const issue = validateRules(rules);
          setError(issue);
          if (!issue) setConfirm(true);
        }}
      >
        <fieldset className="portal-fields stack" disabled={confirm}>
          {rules.map((rule, i) => (
            <div className="portal-rule" key={rule.id}>
              <label className="staff-field">
                <span>Nhóm quy tắc</span>
                <input
                  required
                  maxLength={64}
                  pattern="[A-Za-z][A-Za-z0-9_-]*"
                  value={rule.category}
                  onChange={(e) =>
                    setRules(
                      rules.map((r) =>
                        r.id === rule.id
                          ? { ...r, category: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              </label>
              <label className="staff-field">
                <span>Mẫu nội dung</span>
                <input
                  required
                  maxLength={120}
                  value={rule.pattern}
                  onChange={(e) =>
                    setRules(
                      rules.map((r) =>
                        r.id === rule.id
                          ? { ...r, pattern: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-sm"
                disabled={rules.length <= 1}
                onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}
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
                setRules([
                  ...rules,
                  ...editableRules([{ category: "", pattern: "" }]),
                ])
              }
            >
              Thêm quy tắc
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!changed}
            >
              Lưu thay đổi
            </button>
            <button
              type="button"
              className="btn"
              disabled={!changed}
              onClick={() => {
                setRules(editableRules(snapshot.rules));
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
              body: {
                expectedVersion: snapshot.version,
                rules: ruleValues(rules),
                reason,
              },
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
            type="button"
            className="btn"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Làm mới
          </button>
        }
      />
      {success && (
        <output className="staff-success">Đã lưu quy tắc kiểm duyệt.</output>
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
