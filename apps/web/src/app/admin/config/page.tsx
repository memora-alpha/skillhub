"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import { Icon } from "@/components/console/icon";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { Card, GatedButton, Notice, PageHeader } from "@/components/console/ui";
import { CONFIG_LOCKED, MODERATION_RULES } from "@/lib/console/data";

type Rule = { id: string; label: string; patterns: string[] };

const INITIAL = { rules: MODERATION_RULES as Rule[], maxMb: 10, ttl: 120 };

export default function AdminConfigPage() {
  const { can, record } = useConsole();
  const [saved, setSaved] = useState(INITIAL);
  const [rules, setRules] = useState<Rule[]>(INITIAL.rules);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [maxMb, setMaxMb] = useState(String(INITIAL.maxMb));
  const [ttl, setTtl] = useState(String(INITIAL.ttl));
  const [confirming, setConfirming] = useState(false);

  const mb = Number(maxMb);
  const ttlN = Number(ttl);
  const mbOk = Number.isInteger(mb) && mb >= 1 && mb <= 100;
  const ttlOk = Number.isInteger(ttlN) && ttlN >= 1 && ttlN <= 300;
  const dirty =
    JSON.stringify(rules) !== JSON.stringify(saved.rules) ||
    mb !== saved.maxMb ||
    ttlN !== saved.ttl;

  function addPattern(ruleId: string) {
    const value = (drafts[ruleId] ?? "").trim().toLowerCase();
    if (!value) return;
    setRules((p) =>
      p.map((r) =>
        r.id === ruleId && !r.patterns.includes(value)
          ? { ...r, patterns: [...r.patterns, value] }
          : r,
      ),
    );
    setDrafts((d) => ({ ...d, [ruleId]: "" }));
  }

  function removePattern(ruleId: string, pattern: string) {
    setRules((p) =>
      p.map((r) =>
        r.id === ruleId
          ? { ...r, patterns: r.patterns.filter((x) => x !== pattern) }
          : r,
      ),
    );
  }

  function save(reason: string) {
    const changed = [
      JSON.stringify(rules) !== JSON.stringify(saved.rules) &&
        "learningRequest.moderationRuleSet",
      mb !== saved.maxMb && "storage.evidenceMaxBytes",
      ttlN !== saved.ttl && "storage.downloadTtlSeconds",
    ].filter(Boolean);
    record({
      action: "SYSTEM_CONFIGURATION_UPDATE",
      target: `CONFIG:${changed.join(",")}`,
      reason,
      before: `evidence=${saved.maxMb}MB ttl=${saved.ttl}s rules=${saved.rules.reduce((n, r) => n + r.patterns.length, 0)}`,
      after: `evidence=${mb}MB ttl=${ttlN}s rules=${rules.reduce((n, r) => n + r.patterns.length, 0)}`,
    });
    setSaved({ rules, maxMb: mb, ttl: ttlN });
    setConfirming(false);
  }

  return (
    <>
      <PageHeader
        title="Cấu hình hệ thống"
        desc="Giá trị nghiệp vụ cố định theo SRS chỉ xem được. Các thiết lập còn lại chỉnh được và mọi thay đổi đều ghi Audit log kèm lý do."
        actions={
          <GatedButton
            allowed={can("config.update")}
            className="btn btn-primary"
            disabled={!dirty || !mbOk || !ttlOk}
            onClick={() => setConfirming(true)}
          >
            <Icon name="check" size={16} /> Lưu thay đổi
          </GatedButton>
        }
      />
      <div className="stack">
        <Card title="Giá trị cố định (SRS 1.6)" flush>
          <dl className="kv-rows">
            {CONFIG_LOCKED.map((c) => (
              <div key={c.key} className="kv-row">
                <dt>
                  <Icon name="lock" size={14} /> {c.label}
                </dt>
                <dd>
                  <strong>{c.value}</strong>
                  <span className="muted">{c.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Bộ quy tắc kiểm duyệt Learning Request">
          <div className="stack">
            <Notice tone="info">
              Bài đăng chứa từ khóa dưới đây sẽ được gắn cờ và chuyển vào hàng
              đợi <strong>PENDING_MODERATION</strong>. Dùng{" "}
              <span className="mono">*</span> làm ký tự đại diện.
            </Notice>
            {rules.map((r) => (
              <div key={r.id} className="rule">
                <strong>{r.label}</strong>
                <div className="chips">
                  {r.patterns.map((p) => (
                    <span key={p} className="chip">
                      <span className="mono">{p}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Xóa từ khóa ${p}`}
                        disabled={!can("config.update")}
                        onClick={() => removePattern(r.id, p)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="row">
                  <label className="grow">
                    <span className="sr-only">Thêm từ khóa cho {r.label}</span>
                    <input
                      className="input"
                      placeholder="Thêm từ khóa…"
                      value={drafts[r.id] ?? ""}
                      disabled={!can("config.update")}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPattern(r.id);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={!can("config.update")}
                    onClick={() => addPattern(r.id)}
                  >
                    <Icon name="plus" size={16} /> Thêm
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tệp & tải xuống">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="cfg-mb">
                Dung lượng tối đa của bằng chứng (MB)
              </label>
              <input
                id="cfg-mb"
                className="input"
                inputMode="numeric"
                value={maxMb}
                aria-invalid={!mbOk}
                disabled={!can("config.update")}
                onChange={(e) => setMaxMb(e.target.value)}
              />
              <div className={mbOk ? "hint" : "field-error"}>
                Từ 1 đến 100 MB. Tin nhắn chat giới hạn riêng 15 MB.
              </div>
            </div>
            <div className="field">
              <label htmlFor="cfg-ttl">
                Thời hạn liên kết tải xuống (giây)
              </label>
              <input
                id="cfg-ttl"
                className="input"
                inputMode="numeric"
                value={ttl}
                aria-invalid={!ttlOk}
                disabled={!can("config.update")}
                onChange={(e) => setTtl(e.target.value)}
              />
              <div className={ttlOk ? "hint" : "field-error"}>
                Từ 1 đến 300 giây.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {confirming && (
        <ReasonDialog
          title="Lưu cấu hình hệ thống"
          description="Thay đổi có hiệu lực ngay với toàn hệ thống."
          confirmLabel="Lưu cấu hình"
          help="Bắt buộc. Lý do được ghi vào Audit log cùng giá trị trước và sau."
          onClose={() => setConfirming(false)}
          onConfirm={save}
        />
      )}
    </>
  );
}
