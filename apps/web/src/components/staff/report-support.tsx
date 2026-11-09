"use client";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
import {
  reportReasonLabel,
  reportDateLabel,
  severityTone,
} from "@/lib/staff/report-presentation";
import { IncidentPanel, SeveritySelect } from "./report-incident";
import { ReportDetailScreen } from "./reports";
import { severities, type SupportCase } from "./report-support-types";
export { CaseSupportPanel } from "./case-support";
const statuses = [
  ["OPEN", "Mới"],
  ["UNDER_REVIEW", "Đang xem xét"],
  ["NEED_MORE_INFO", "Cần bổ sung"],
  ["RESOLVED", "Đã xử lý"],
  ["REJECTED", "Đã từ chối"],
] as const;
export function SupportQueueScreen() {
  const { api, actor } = useStaffSession();
  const [scope, setScope] = useState("open");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [currentId, setCurrentId] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState(false);
  const [incident, setIncident] = useState<string>();
  const [groupSeverity, setGroupSeverity] = useState("MEDIUM");
  const [classify, setClassify] = useState<SupportCase>();
  const params = new URLSearchParams({ limit: "20" });
  if (severity) params.set("severity", severity);
  if (status) params.set("status", status);
  if (scope === "mine" && actor) params.set("handlerId", actor.userId);
  const list = useStaffList<SupportCase>(`reports/support/queue?${params}`);
  const reset = () => {
    setSelected([]);
    setCurrentId(undefined);
  };
  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = list.items.filter((row) =>
    `${row.id} ${row.reasonCode} ${reportReasonLabel(row.reasonCode)}`
      .toLocaleLowerCase("vi")
      .includes(needle),
  );
  const detailId = currentId ?? visible[0]?.id;
  const options = statuses.filter(([code]) =>
    scope === "closed"
      ? ["RESOLVED", "REJECTED"].includes(code)
      : scope === "open"
        ? !["RESOLVED", "REJECTED"].includes(code)
        : true,
  );
  function selectCase(id: string) {
    setCurrentId(id);
    if (window.matchMedia("(max-width: 900px)").matches)
      requestAnimationFrame(() => {
        const panel = document.getElementById("ops-selected-case");
        panel?.scrollIntoView({ block: "start", behavior: "smooth" });
        panel?.focus({ preventScroll: true });
      });
  }
  return (
    <section className="ops-reports">
      <PageHeader
        title="Báo cáo & tranh chấp"
        desc="Tiếp nhận, kiểm tra bằng chứng và xử lý từng vụ việc."
        actions={
          <button
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => {
              setSelected([]);
              void list.reload();
            }}
          >
            <Icon name="refresh" size={16} /> Làm mới
          </button>
        }
      />
      <div className="ops-tabbar">
        <Segmented
          label="Phạm vi báo cáo"
          value={scope}
          options={[
            { id: "open", label: "Đang mở" },
            { id: "mine", label: "Tôi phụ trách" },
            { id: "closed", label: "Đã kết thúc" },
          ]}
          onChange={(value) => {
            setScope(value);
            setStatus(value === "closed" ? "RESOLVED" : "");
            reset();
          }}
        />
      </div>
      <div className="toolbar ops-queue-toolbar">
        <SearchBox
          label="Tìm trong các báo cáo đã tải"
          placeholder="Mã hoặc lý do trong các mục đã tải…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setCurrentId(undefined);
          }}
        />
        <label className="ops-filter">
          <span>Mức độ</span>
          <select
            className="select"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              reset();
            }}
          >
            <option value="">Tất cả</option>
            {severities.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-filter">
          <span>Trạng thái</span>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
          >
            {scope !== "closed" && <option value="">Đang mở</option>}
            {options.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted ops-loaded-count">
          {list.items.length}
          {list.page?.hasMore ? "+" : ""} mục đã tải
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            className="btn"
            disabled={
              list.loading || selected.length < 2 || selected.length > 100
            }
            onClick={() => setGroup(true)}
          >
            Gom {selected.length} báo cáo
          </button>
        )}
      </div>
      <div className="ops-report-workspace">
        <Card className="ops-report-list" flush>
          <QueueState
            loading={list.loading}
            error={list.error}
            empty={!list.items.length}
            reload={list.reload}
          >
            {!visible.length ? (
              <Empty
                title="Không có kết quả trong các mục đã tải"
                desc="Thử từ khóa khác hoặc tải thêm báo cáo."
              />
            ) : (
              <div className="ops-case-list" aria-label="Danh sách báo cáo">
                {visible.map((row) => (
                  <article
                    key={row.id}
                    className="ops-case-item"
                    data-selected={detailId === row.id}
                  >
                    <div className="ops-case-item-top">
                      <label className="ops-case-checkbox">
                        <input
                          type="checkbox"
                          aria-label={`Chọn báo cáo ${row.id.slice(0, 8)} để gom vụ việc`}
                          disabled={
                            !!row.incidentId ||
                            ["RESOLVED", "REJECTED"].includes(row.status) ||
                            !!(row.handlerId && row.handlerId !== actor?.userId)
                          }
                          checked={selected.includes(row.id)}
                          onChange={(e) =>
                            setSelected((value) =>
                              e.target.checked
                                ? [...value, row.id]
                                : value.filter((id) => id !== row.id),
                            )
                          }
                        />
                        <span className="mono">#{row.id.slice(0, 8)}</span>
                      </label>
                      <Badge tone={severityTone(row.severity)}>
                        {severities.find((s) => s.code === row.severity)
                          ?.label ?? "Chưa phân loại"}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      className="ops-case-select"
                      aria-pressed={detailId === row.id}
                      onClick={() => selectCase(row.id)}
                    >
                      <strong>{reportReasonLabel(row.reasonCode)}</strong>
                      <span className="muted">
                        {reportDateLabel(row.createdAt)}
                      </span>
                      <span className="muted">
                        {!row.handlerId
                          ? "Chưa có người nhận"
                          : row.handlerId === actor?.userId
                            ? "Bạn đang phụ trách"
                            : "Nhân viên khác phụ trách"}
                      </span>
                    </button>
                    <div className="ops-case-item-foot">
                      <StatusBadge status={row.status} />
                      <button
                        type="button"
                        className="link ops-text-button"
                        onClick={() => {
                          if (row.incidentId) setIncident(row.incidentId);
                          else {
                            setGroupSeverity(row.severity || "MEDIUM");
                            setClassify(row);
                          }
                        }}
                      >
                        Đổi mức độ
                      </button>
                      {row.incidentId && (
                        <button
                          type="button"
                          className="link ops-text-button"
                          onClick={() => setIncident(row.incidentId!)}
                        >
                          Vụ việc chung
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </QueueState>
          <Pager
            loading={list.loading}
            more={list.more}
            hasMore={list.page?.hasMore}
          />
        </Card>
        <section
          id="ops-selected-case"
          className="ops-case-workspace"
          tabIndex={-1}
          aria-label="Chi tiết báo cáo đang chọn"
        >
          {detailId ? (
            <ReportDetailScreen
              key={`${actor?.userId}:${detailId}`}
              id={detailId}
              embedded
              onUpdated={() => {
                void list.reload();
              }}
            />
          ) : (
            <Card>
              <Empty
                title="Chọn báo cáo để xem chi tiết"
                desc="Thông tin, bằng chứng và thao tác xử lý sẽ hiển thị tại đây."
              />
            </Card>
          )}
        </section>
      </div>
      {group && (
        <DecisionDialog
          title="Gom báo cáo cùng vụ việc"
          description="Chỉ gom các báo cáo cùng đối tượng và buổi học. Bạn sẽ phụ trách vụ việc chung."
          min={3}
          max={2000}
          confirmLabel="Gom vụ việc"
          onClose={() => setGroup(false)}
          onReload={list.reload}
          onSubmit={async (reason) => {
            const result = await api<{ id: string }>(
              "reports/support/incidents",
              {
                method: "POST",
                body: { caseIds: selected, severity: groupSeverity, reason },
              },
            );
            setGroup(false);
            reset();
            setIncident(result.data.id);
            await list.reload();
          }}
        >
          <SeveritySelect value={groupSeverity} onChange={setGroupSeverity} />
        </DecisionDialog>
      )}
      {classify && (
        <DecisionDialog
          title="Đổi mức độ báo cáo"
          description="Báo cáo đã gom được đổi qua vụ việc chung."
          min={3}
          max={2000}
          confirmLabel="Lưu mức độ"
          onClose={() => setClassify(undefined)}
          onReload={list.reload}
          onSubmit={async (reason) => {
            await api(`reports/support/cases/${classify.id}/severity`, {
              method: "POST",
              body: {
                severity: groupSeverity,
                expectedVersion: classify.version,
                reason,
              },
            });
            setClassify(undefined);
            await list.reload();
          }}
        >
          <SeveritySelect value={groupSeverity} onChange={setGroupSeverity} />
        </DecisionDialog>
      )}
      {incident && (
        <IncidentPanel
          key={incident}
          id={incident}
          close={() => setIncident(undefined)}
          onUpdated={list.reload}
        />
      )}
    </section>
  );
}
