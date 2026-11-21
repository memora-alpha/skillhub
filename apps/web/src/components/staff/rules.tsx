"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
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

const srsBusinessStandards = [
  {
    group: "Thời lượng & Đổi lịch Session",
    value: "60–180 phút · Cutoff 60 phút",
    detail:
      "Mỗi buổi học dài 1–3 giờ. Đổi lịch chỉ hiệu lực khi cả hai bên xác nhận trước giờ bắt đầu ít nhất 60 phút.",
  },
  {
    group: "Bảo mật OTP",
    value: "Sai 5 lần → Softban email 24 giờ",
    detail:
      "Chặn gửi/xác minh OTP trong 24 giờ theo email chuẩn hóa, không reset khi resend và không khóa đăng nhập hợp lệ.",
  },
  {
    group: "Reputation & Phục hồi (V1.6)",
    value: "Khởi tạo 50/100 · Mức hạn chế <40",
    detail:
      "30–39 khóa tạo mới 24h; 20–29 khóa 3 ngày + xác nhận chính sách; 10–19 khóa 7 ngày; 0–9 khóa 30 ngày. Nhiệm vụ phục hồi tối đa +5/30 ngày.",
  },
];

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
        <Badge tone="brand">Phiên bản {snapshot.version}</Badge>
        <Badge tone="neutral">{rules.length}/250 quy tắc</Badge>
        <span className="muted">Đọc lúc {fmtDateTime(snapshot.readAt)}</span>
      </div>
      <p className="muted">
        Khi người dùng đăng yêu cầu học, nội dung khớp quy tắc sẽ chuyển sang
        trạng thái <strong>Chờ kiểm duyệt</strong> để Staff/Admin xem xét. Dùng{" "}
        <code>*</code> để khớp một đoạn văn bản bất kỳ.
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
                  pattern="[A-Za-z][A-Za-z0-9_\-]*"
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
                className="btn btn-sm admin-danger-outline"
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
          presentation="drawer"
          title="Lưu quy tắc kiểm duyệt"
          description={`${rules.length} quy tắc sẽ thay thế bộ quy tắc hiện tại và ghi nhận trong Audit Log.`}
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
    <div className="stack">
      <PageHeader
        title="Cấu hình nghiệp vụ"
        desc="Quản lý bộ lọc kiểm duyệt yêu cầu học và đối chiếu các quy chuẩn vận hành SRS V1.6 đang áp dụng."
        actions={
          <div className="row">
            <Link className="btn" href="/admin/credits?tab=fees">
              Quản lý Credit &amp; chính sách phí →
            </Link>
            <LoadingButton
              type="button"
              className="btn"
              disabled={resource.loading}
              onClick={resource.reload}
              loading={!!resource.loading}
            >
              Làm mới
            </LoadingButton>
          </div>
        }
      />
      {success && (
        <output className="staff-success">Đã lưu quy tắc kiểm duyệt.</output>
      )}
      <Card title="Bộ lọc từ khóa kiểm duyệt yêu cầu học">
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

      <Card
        title="Quy chuẩn nghiệp vụ SRS V1.6 đang áp dụng"
        actions={<Badge tone="info">Chỉ đọc · Nội dung tham chiếu</Badge>}
      >
        <div className="ops-config-grid">
          {srsBusinessStandards.map((item) => (
            <article className="ops-config-card" key={item.group}>
              <span>{item.group}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
