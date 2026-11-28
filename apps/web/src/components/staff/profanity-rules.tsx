"use client";
import { useId, useState } from "react";
import {
  Badge,
  Card,
  DataTable,
  Empty,
  SearchBox,
} from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { fmtDateTime } from "@/lib/console/format";
import { LoadingButton } from "@/components/loading-button";
import { hasPermission } from "@/lib/staff/permissions";
import {
  maxProfanityAliases,
  maxProfanityRules,
  maxProfanityTermLength,
  validateProfanityRuleDraft,
  validateProfanityRuleSet,
  type ProfanityRule as Rule,
} from "@/lib/staff/profanity-rules";
import { AdminDrawer } from "./admin-ui";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { DecisionDialog, QueueState } from "./common";
import { useStaffResource, useStaffTask } from "./hooks";
import { useStaffSession } from "./session";
import styles from "./admin-config.module.css";

type Snapshot = { version: number; effectiveAt: string; rules: Rule[] };
type Revisions = {
  items: {
    version: number;
    effectiveAt: string;
    actorSnapshot?: {
      fullName?: string | null;
      email?: string | null;
      userId?: string | null;
    } | null;
    auditId?: string | null;
  }[];
  nextCursor: number | null;
};
type PreviewResult = {
  outcome: string;
  match?: { ruleId: string } | null;
  changeCount: { added: number; updated: number; disabled: number };
  changedSeeds?: string[];
};
type StatusFilter = "" | "enabled" | "disabled";

const endpoint = "profanity-rules";

function revisionActorLabel(
  actor: Revisions["items"][number]["actorSnapshot"],
) {
  if (!actor) return null;
  return actor.fullName || actor.email || actor.userId || null;
}

function Editor({
  value,
  reload,
}: Readonly<{ value: Snapshot; reload: () => void }>) {
  const { api } = useStaffSession();
  const [rules, setRules] = useState<Rule[]>(value.rules);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; rule: Rule } | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [decision, setDecision] = useState<"save" | number>();

  const submittedRules = rules.map((rule) => ({
    ...rule,
    term: rule.term.trim(),
    aliases: rule.aliases.map((entry) => entry.trim()).filter(Boolean),
  }));
  const changed = JSON.stringify(rules) !== JSON.stringify(value.rules);
  const ruleSetError = validateProfanityRuleSet(submittedRules);

  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = rules.filter((rule) => {
    if (statusFilter === "enabled" && !rule.enabled) return false;
    if (statusFilter === "disabled" && rule.enabled) return false;
    if (!needle) return true;
    return [rule.term, ...rule.aliases].some((item) =>
      item.toLocaleLowerCase("vi").includes(needle),
    );
  });

  const enabledCount = rules.filter((rule) => rule.enabled).length;

  return (
    <div className={styles.workspace}>
      {changed && (
        <div className={styles.dirtyBanner}>
          <div className={styles.dirtyBannerInfo}>
            <Icon name="alert" size={16} />
            <output>
              Bạn có thay đổi chưa áp dụng trên danh sách từ ngữ ({rules.length}{" "}
              quy tắc).
            </output>
          </div>
          <div className={styles.metaActions}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setRules(value.rules)}
            >
              Hoàn tác
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={Boolean(ruleSetError)}
              onClick={() => setDecision("save")}
            >
              Áp dụng bộ lọc
            </button>
          </div>
        </div>
      )}

      {ruleSetError && (
        <p className="staff-error" role="alert">
          {ruleSetError}
        </p>
      )}

      <Card flush>
        <div className={styles.metaBar}>
          <div className={styles.metaLeft}>
            <Badge tone="brand">Phiên bản v{value.version}</Badge>
            <span>
              <strong>{enabledCount}</strong> đang bật ·{" "}
              <strong>{rules.length}</strong>/{maxProfanityRules} quy tắc
            </span>
            <span>· Cập nhật {fmtDateTime(value.effectiveAt)}</span>
          </div>
          <div className={styles.metaActions}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTesting(true)}
            >
              <Icon name="check" size={14} />
              Kiểm tra thử
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowHistory(true)}
            >
              <Icon name="clock" size={14} />
              Lịch sử
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={rules.length >= maxProfanityRules}
              onClick={() => setEditing({ mode: "create" })}
            >
              <Icon name="plus" size={14} />
              Thêm quy tắc
            </button>
          </div>
        </div>

        <AdminFilterPanel
          flush
          activeCount={statusFilter ? 1 : 0}
          onClear={() => setStatusFilter("")}
          lead={
            <SearchBox
              label="Tìm từ hoặc biến thể trong bộ lọc"
              placeholder="Tìm từ khóa hoặc biến thể…"
              value={search}
              onChange={setSearch}
            />
          }
          actions={
            <span className="muted">
              Hiển thị {visible.length}/{rules.length}
            </span>
          }
        >
          <div className={filterPanelStyles.grid}>
            <label className={filterPanelStyles.field}>
              <span>Trạng thái áp dụng</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="">Tất cả quy tắc</option>
                <option value="enabled">Đang áp dụng</option>
                <option value="disabled">Đang tạm tắt</option>
              </select>
            </label>
          </div>
        </AdminFilterPanel>

        {!visible.length ? (
          <Empty
            title={
              rules.length
                ? "Không tìm thấy quy tắc phù hợp"
                : "Chưa có quy tắc từ ngữ nào"
            }
            desc={
              rules.length
                ? "Thử từ khóa khác hoặc xóa bộ lọc trạng thái."
                : "Nhấn Thêm quy tắc để thiết lập từ khóa bị chặn toàn hệ thống."
            }
          />
        ) : (
          <DataTable
            columns={[
              "#",
              "Từ / cụm từ chặn",
              "Biến thể",
              "Trạng thái",
              "Thao tác",
            ]}
          >
            {visible.map((rule, index) => {
              const cleanAliases = rule.aliases.filter((a) => a.trim());
              return (
                <tr key={rule.id}>
                  <td className={styles.indexCell}>{index + 1}</td>
                  <td>
                    <strong>{rule.term}</strong>
                  </td>
                  <td>
                    {cleanAliases.length ? (
                      <div className={styles.chipList}>
                        {cleanAliases.slice(0, 4).map((alias) => (
                          <span className={styles.chip} key={alias}>
                            {alias}
                          </span>
                        ))}
                        {cleanAliases.length > 4 && (
                          <span className={styles.chipMore}>
                            +{cleanAliases.length - 4} khác
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={
                        rule.enabled
                          ? `${styles.statusToggle} ${styles.statusOn}`
                          : `${styles.statusToggle} ${styles.statusOff}`
                      }
                      aria-pressed={rule.enabled}
                      onClick={() =>
                        setRules((rows) =>
                          rows.map((row) =>
                            row.id === rule.id
                              ? { ...row, enabled: !row.enabled }
                              : row,
                          ),
                        )
                      }
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      {rule.enabled ? "Đang bật" : "Đang tắt"}
                    </button>
                  </td>
                  <td className={styles.actionCell}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditing({ mode: "edit", rule })}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm admin-danger-outline"
                        aria-label={`Xóa quy tắc ${rule.term}`}
                        onClick={() =>
                          setRules((rows) =>
                            rows.filter((row) => row.id !== rule.id),
                          )
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {editing && (
        <ProfanityRuleDrawer
          mode={editing.mode}
          initial={editing.mode === "edit" ? editing.rule : undefined}
          existingRules={rules}
          close={() => setEditing(null)}
          onSave={(nextRule) => {
            if (editing.mode === "create") {
              setRules((rows) => [nextRule, ...rows]);
            } else {
              setRules((rows) =>
                rows.map((row) => (row.id === nextRule.id ? nextRule : row)),
              );
            }
            setEditing(null);
          }}
        />
      )}

      {testing && (
        <ProfanityPreviewDrawer
          rules={submittedRules}
          validationError={ruleSetError}
          close={() => setTesting(false)}
        />
      )}

      {showHistory && (
        <ProfanityHistoryDrawer
          currentVersion={value.version}
          close={() => setShowHistory(false)}
          onRestore={(targetVersion) => {
            setShowHistory(false);
            setDecision(targetVersion);
          }}
        />
      )}

      {decision !== undefined && (
        <DecisionDialog
          presentation="drawer"
          title={
            decision === "save"
              ? "Áp dụng bộ lọc từ ngữ"
              : `Khôi phục phiên bản v${decision}`
          }
          description="Thay đổi áp dụng ngay cho nội dung toàn hệ thống và được ghi vào nhật ký hoạt động."
          min={1}
          max={500}
          confirmLabel="Xác nhận thay đổi"
          onClose={() => setDecision(undefined)}
          onReload={reload}
          onSubmit={async (reason) => {
            await api(endpoint + (decision === "save" ? "" : "/rollback"), {
              method: decision === "save" ? "PUT" : "POST",
              body: {
                expectedVersion: value.version,
                ...(decision === "save"
                  ? { rules: submittedRules }
                  : { targetVersion: decision }),
                reason,
              },
            });
            setDecision(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ProfanityRuleDrawer({
  mode,
  initial,
  existingRules,
  close,
  onSave,
}: Readonly<{
  mode: "create" | "edit";
  initial?: Rule;
  existingRules: readonly Rule[];
  close: () => void;
  onSave: (rule: Rule) => void;
}>) {
  const formId = useId();
  const [term, setTerm] = useState(initial?.term ?? "");
  const [aliasesText, setAliasesText] = useState(
    initial?.aliases.join("\n") ?? "",
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [error, setError] = useState("");

  return (
    <AdminDrawer
      title={mode === "create" ? "Thêm quy tắc từ ngữ" : "Chỉnh sửa quy tắc"}
      subtitle="Quy tắc mới sẽ được lưu vào bản nháp. Nhấn Áp dụng bộ lọc để kích hoạt toàn hệ thống."
      close={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            Hủy
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            {mode === "create" ? "Thêm vào danh sách" : "Cập nhật quy tắc"}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.drawerForm}
        onSubmit={(event) => {
          event.preventDefault();
          const cleanTerm = term.trim();
          const cleanAliases = aliasesText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          const draftError = validateProfanityRuleDraft(
            { id: initial?.id, term: cleanTerm, aliases: cleanAliases },
            existingRules,
          );
          if (draftError) {
            setError(draftError);
            return;
          }
          onSave({
            id: initial?.id ?? crypto.randomUUID(),
            term: cleanTerm,
            aliases: cleanAliases,
            enabled,
          });
        }}
      >
        <label className={styles.drawerField}>
          <span>Từ hoặc cụm từ chính</span>
          <input
            required
            maxLength={maxProfanityTermLength}
            value={term}
            placeholder="Nhập từ khóa cần chặn…"
            onChange={(event) => {
              setTerm(event.target.value);
              setError("");
            }}
          />
          <small>
            Tối đa {maxProfanityTermLength} ký tự; mỗi từ phải bắt đầu bằng chữ
            cái hoặc chữ số.
          </small>
        </label>

        <label className={styles.drawerField}>
          <span>Các cách viết biến thể (tùy chọn)</span>
          <textarea
            value={aliasesText}
            placeholder={"Nhập mỗi biến thể trên một dòng…"}
            onChange={(event) => {
              setAliasesText(event.target.value);
              setError("");
            }}
          />
          <small>
            Mỗi dòng 1 biến thể, tối đa {maxProfanityAliases} dòng và không
            trùng từ/biến thể đã có.
          </small>
        </label>

        <label className={filterPanelStyles.checkbox}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>Bật áp dụng ngay khi lưu bộ lọc</span>
        </label>

        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </AdminDrawer>
  );
}

function ProfanityPreviewDrawer({
  rules,
  validationError,
  close,
}: Readonly<{
  rules: readonly Rule[];
  validationError: string | null;
  close: () => void;
}>) {
  const { api } = useStaffSession();
  const command = useStaffTask();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult>();

  return (
    <AdminDrawer
      title="Kiểm tra thử bộ lọc"
      subtitle="Chạy thử một đoạn văn bản mẫu với danh sách quy tắc hiện tại (bao gồm cả thay đổi chưa lưu)."
      close={close}
      busy={command.busy}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={command.busy}
            onClick={close}
          >
            Đóng
          </button>
          <LoadingButton
            type="button"
            className="btn btn-primary"
            loading={command.busy}
            disabled={!text.trim() || Boolean(validationError)}
            onClick={() =>
              void command.run(async () => {
                const result = await api<PreviewResult>(endpoint + "/preview", {
                  method: "POST",
                  body: { rules, text },
                });
                setPreview(result.data);
              })
            }
          >
            Chạy kiểm tra
          </LoadingButton>
        </>
      }
    >
      <div className={styles.drawerForm}>
        {validationError && (
          <p className="staff-error" role="alert">
            {validationError}
          </p>
        )}
        <label className={styles.drawerField}>
          <span>Nội dung cần kiểm tra</span>
          <textarea
            maxLength={4000}
            value={text}
            placeholder="Dán hoặc nhập nội dung mẫu tại đây…"
            onChange={(event) => {
              setText(event.target.value);
              setPreview(undefined);
            }}
          />
        </label>

        {preview && (
          <output
            className={
              preview.outcome === "BLOCK"
                ? `${styles.previewBox} ${styles.previewBlock}`
                : `${styles.previewBox} ${styles.previewAllow}`
            }
          >
            <strong>
              {preview.outcome === "BLOCK"
                ? "Kết quả: Nội dung bị chặn"
                : "Kết quả: Nội dung hợp lệ (được phép)"}
            </strong>
            {preview.match?.ruleId &&
              (() => {
                const matched = rules.find(
                  (rule) => rule.id === preview.match?.ruleId,
                );
                return (
                  <span>
                    Khớp quy tắc:{" "}
                    <strong>
                      {matched
                        ? `“${matched.term}”`
                        : `#${preview.match.ruleId.slice(0, 8)}`}
                    </strong>
                  </span>
                );
              })()}
            <span>
              Chênh lệch so với bản đang chạy: +{preview.changeCount.added}{" "}
              thêm, {preview.changeCount.updated} sửa,{" "}
              {preview.changeCount.disabled} tắt.
            </span>
            {!!preview.changedSeeds?.length && (
              <small>
                Từ mẫu thay đổi trạng thái ({preview.changedSeeds.length}):{" "}
                {preview.changedSeeds.join(", ")}
              </small>
            )}
          </output>
        )}

        {command.error && (
          <p className="staff-error" role="alert">
            {command.error}
          </p>
        )}
      </div>
    </AdminDrawer>
  );
}

function ProfanityHistoryDrawer({
  currentVersion,
  close,
  onRestore,
}: Readonly<{
  currentVersion: number;
  close: () => void;
  onRestore: (version: number) => void;
}>) {
  const [before, setBefore] = useState<number>();
  const history = useStaffResource<Revisions>(
    endpoint + "/revisions" + (before ? "?before=" + before : ""),
  );

  return (
    <AdminDrawer
      title="Lịch sử phiên bản bộ lọc"
      subtitle="Xem các mốc cập nhật và khôi phục phiên bản trước đó khi cần."
      close={close}
      footer={
        <button type="button" className="btn" onClick={close}>
          Đóng
        </button>
      }
    >
      <QueueState
        loading={history.loading}
        error={history.error}
        empty={!history.data?.items.length}
        reload={history.reload}
        emptyTitle="Chưa có lịch sử phiên bản"
        emptyDescription="Các thay đổi bộ lọc sau khi lưu sẽ được ghi lại tại đây."
      >
        <DataTable
          columns={["Phiên bản", "Hiệu lực lúc", "Người cập nhật", "Thao tác"]}
        >
          {history.data?.items.map((row) => {
            const actorLabel = revisionActorLabel(row.actorSnapshot);
            const isCurrent = row.version === currentVersion;
            return (
              <tr key={row.version}>
                <td>
                  <Badge tone={isCurrent ? "ok" : "neutral"}>
                    v{row.version}
                  </Badge>
                </td>
                <td>{fmtDateTime(row.effectiveAt)}</td>
                <td>{actorLabel ?? "Hệ thống"}</td>
                <td className={styles.actionCell}>
                  {isCurrent ? (
                    <span className="muted">Hiện tại</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onRestore(row.version)}
                    >
                      Khôi phục
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
        {(history.data?.nextCursor || before) && (
          <div className="row" style={{ marginTop: 14 }}>
            {history.data?.nextCursor && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setBefore(history.data!.nextCursor!)}
              >
                Phiên bản cũ hơn
              </button>
            )}
            {before && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setBefore(undefined)}
              >
                Về bản mới nhất
              </button>
            )}
          </div>
        )}
      </QueueState>
    </AdminDrawer>
  );
}

export function ProfanityRules() {
  const { actor } = useStaffSession();
  const allowed = hasPermission(actor, "content-moderation:configure");
  const resource = useStaffResource<Snapshot>(endpoint, { enabled: allowed });
  if (!allowed) return null;
  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!resource.data}
      reload={resource.reload}
    >
      {resource.data && (
        <Editor
          key={resource.data.version}
          value={resource.data}
          reload={resource.reload}
        />
      )}
    </QueueState>
  );
}
