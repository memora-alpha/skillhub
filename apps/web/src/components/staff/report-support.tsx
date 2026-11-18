"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
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
import {
  openReportStatuses,
  reportMatchesView,
  reportQueueParams,
  type ReportQueueView,
} from "@/lib/staff/report-queue-view";
import type { ReportCaseDetail } from "@/lib/staff/types";
import {
  assertReportEditable,
  isSystemReport,
} from "@/lib/staff/report-access";

import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
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
  ["CLOSED", "Đã đóng"],
] as const;
export function SupportQueueScreen({
  initialIncidentId,
}: Readonly<{ initialIncidentId?: string }>) {
  const { api, actor } = useStaffSession();
  const [scope, setScope] = useState<ReportQueueView>("actionable");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [currentId, setCurrentId] = useState<string>();
  const [mobileDetail, setMobileDetail] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState(false);
  const [incident, setIncident] = useState<string | undefined>(() =>
    initialIncidentId &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(initialIncidentId)
      ? initialIncidentId
      : undefined,
  );
  const [groupSeverity, setGroupSeverity] = useState("MEDIUM");
  const [classify, setClassify] = useState<SupportCase>();
  const params = reportQueueParams({
    view: scope,
    severity,
    status,
    source,
    handlerId: assignedOnly ? actor?.userId : undefined,
  });
  const list = useStaffListPages<SupportCase>(
    `reports/support/queue?${params}`,
  );
  const reset = () => {
    setSelected([]);
    setCurrentId(undefined);
    setMobileDetail(false);
    setGroup(false);
    setClassify(undefined);
    setIncident(undefined);
  };
  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = list.items.filter(
    (row) =>
      reportMatchesView(row, scope) &&
      `${row.id} ${row.reasonCode} ${reportReasonLabel(row.reasonCode)}`
        .toLocaleLowerCase("vi")
        .includes(needle),
  );
  const detailId =
    visible.find((row) => row.id === currentId)?.id ?? visible[0]?.id;
  const selectedCases = list.items.filter((row) => selected.includes(row.id));
  const groupContext = selectedCases[0];
  function selectionIssue(row: SupportCase) {
    if (isSystemReport(row)) return "Báo cáo hệ thống chỉ cho phép xem.";
    if (row.incidentId) return "Báo cáo đã thuộc một vụ việc chung.";
    if (["RESOLVED", "REJECTED"].includes(row.status))
      return "Báo cáo đã kết thúc.";
    if (row.handlerId && row.handlerId !== actor?.userId)
      return "Báo cáo do nhân viên khác phụ trách.";
    if (
      groupContext &&
      ["targetType", "targetId", "relatedPathId", "relatedSessionId"].some(
        (key) =>
          row[key as keyof SupportCase] !==
          groupContext[key as keyof SupportCase],
      )
    )
      return "Chỉ chọn các báo cáo cùng đối tượng, lộ trình và buổi học.";
    if (selected.length >= 100 && !selected.includes(row.id))
      return "Mỗi vụ việc gom tối đa 100 báo cáo.";
    return undefined;
  }
  const options = statuses.filter(
    ([code]) => scope === "all" || openReportStatuses.includes(code),
  );
  function selectCase(id: string) {
    setCurrentId(id);
    setMobileDetail(true);
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
          <LoadingButton
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => {
              setSelected([]);
              void list.reload();
            }}
            loading={!!list.loading}
          >
            <Icon name="refresh" size={16} /> Làm mới
          </LoadingButton>
        }
      />
      <div className="ops-tabbar">
        <Segmented
          label="Phạm vi báo cáo"
          value={scope}
          options={[
            { id: "actionable", label: "Cần giải quyết" },
            { id: "all", label: "Tất cả" },
          ]}
          onChange={(value) => {
            setScope(value as ReportQueueView);
            setStatus(value === "all" ? "ALL" : "");
            setSource("");
            reset();
          }}
        />
      </div>
      <div className="toolbar ops-queue-toolbar">
        <SearchBox
          label="Tìm trong các báo cáo trên trang hiện tại"
          placeholder="Mã hoặc lý do trong trang hiện tại…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setCurrentId(undefined);
            setMobileDetail(false);
          }}
        />
        {scope === "all" && (
          <label className="ops-filter ops-source-filter">
            <span>Nguồn báo cáo</span>
            <select
              className="select"
              aria-label="Nguồn báo cáo"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                reset();
              }}
            >
              <option value="">Tất cả nguồn</option>
              <option value="SYSTEM">Hệ thống tự ghi nhận</option>
              <option value="USER">Người dùng gửi</option>
            </select>
          </label>
        )}
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
            <option value={scope === "all" ? "ALL" : ""}>
              {scope === "all" ? "Tất cả trạng thái" : "Đang mở"}
            </option>
            {options.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-filter">
          <span>
            <input
              type="checkbox"
              checked={assignedOnly}
              onChange={(event) => {
                setAssignedOnly(event.target.checked);
                reset();
              }}
            />{" "}
            Chỉ tôi phụ trách
          </span>
        </label>
        {selected.length > 0 && (
          <LoadingButton
            type="button"
            className="btn"
            disabled={
              list.loading ||
              selected.length < 2 ||
              selected.length > 100 ||
              selectedCases.length !== selected.length ||
              selectedCases.some((row) => !!selectionIssue(row))
            }
            onClick={() => {
              const highest = Math.max(
                ...selectedCases.map((row) => {
                  const index = severities.findIndex(
                    (item) => item.code === row.severity,
                  );
                  return index < 0 ? 1 : index;
                }),
              );
              setGroupSeverity(severities[highest]?.code ?? "MEDIUM");
              setGroup(true);
            }}
            loading={!!list.loading}
          >
            Gom {selected.length} báo cáo
          </LoadingButton>
        )}
      </div>
      {(source ||
        severity ||
        search ||
        assignedOnly ||
        (scope === "all" ? status !== "ALL" : !!status)) && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setAssignedOnly(false);
            setSource("");
            setSeverity("");
            setStatus(scope === "all" ? "ALL" : "");
            setSearch("");
            reset();
          }}
        >
          Xóa bộ lọc
        </button>
      )}
      {selected.length > 0 && (
        <p className="muted">
          Đã chọn {selected.length} báo cáo. Chọn thêm báo cáo cùng đối tượng và
          buổi học để gom thành một vụ việc.{" "}
          <button
            type="button"
            className="link ops-text-button"
            onClick={() => setSelected([])}
          >
            Bỏ chọn tất cả
          </button>
        </p>
      )}
      <p className="admin-scope-note">
        Báo cáo mới nhất hiển thị trước. Tìm kiếm chỉ áp dụng cho mã và lý do
        trong các báo cáo trên trang hiện tại.
      </p>
      <div className="ops-report-workspace" data-show-detail={mobileDetail}>
        <Card className="ops-report-list" flush>
          <QueueState
            loading={list.loading}
            error={list.error}
            empty={!list.items.length}
            reload={list.reload}
            emptyTitle={
              scope === "actionable"
                ? "Không có báo cáo cần giải quyết"
                : source === "SYSTEM"
                  ? "Không có báo cáo hệ thống theo bộ lọc hiện tại"
                  : "Hàng đợi trống"
            }
            emptyDescription={
              scope === "actionable"
                ? "Các ghi nhận của hệ thống nằm trong tab Tất cả."
                : "Thử xóa bộ lọc hoặc làm mới danh sách."
            }
          >
            {!visible.length ? (
              <Empty
                title={
                  scope === "actionable"
                    ? "Không có báo cáo cần giải quyết trên trang này"
                    : "Không có kết quả trong trang hiện tại"
                }
                desc={
                  scope === "actionable"
                    ? "Chỉ báo cáo còn mở do người dùng gửi được hiển thị ở đây."
                    : "Thử từ khóa khác hoặc xem trang tiếp theo."
                }
              />
            ) : (
              <div className="ops-case-list" aria-label="Danh sách báo cáo">
                {visible.map((row) => {
                  function handlerLabel() {
                    if (isSystemReport(row)) return "Chỉ xem";
                    if (!row.handlerId) {
                      return "Chưa có người nhận";
                    }
                    if (row.handlerId === actor?.userId) {
                      return "Bạn đang phụ trách";
                    }
                    return "Nhân viên khác phụ trách";
                  }
                  return (
                    <article
                      key={row.id}
                      className="ops-case-item"
                      data-selected={detailId === row.id}
                    >
                      <div className="ops-case-item-top">
                        <div className="ops-case-checkbox">
                          {!isSystemReport(row) && (
                            <input
                              type="checkbox"
                              aria-label={`Chọn báo cáo ${row.id.slice(0, 8)} để gom vụ việc`}
                              disabled={!!selectionIssue(row)}
                              title={selectionIssue(row)}
                              checked={selected.includes(row.id)}
                              onChange={(e) =>
                                setSelected((value) =>
                                  e.target.checked
                                    ? [...value, row.id]
                                    : value.filter((id) => id !== row.id),
                                )
                              }
                            />
                          )}
                          <span className="mono">#{row.id.slice(0, 8)}</span>
                        </div>
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
                        <Badge
                          tone={row.source === "SYSTEM" ? "info" : "neutral"}
                        >
                          {row.source === "SYSTEM"
                            ? "Hệ thống tự ghi nhận"
                            : row.source === "USER"
                              ? "Người dùng gửi"
                              : "Chưa xác định nguồn"}
                        </Badge>
                        <span className="muted">
                          {reportDateLabel(row.createdAt)}
                        </span>
                        <span className="muted">{handlerLabel()}</span>
                      </button>
                      <div className="ops-case-item-foot">
                        <StatusBadge status={row.status} />
                        {!isSystemReport(row) &&
                          ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(
                            row.status,
                          ) &&
                          (!row.handlerId ||
                            row.handlerId === actor?.userId) && (
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
                          )}
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
                  );
                })}
              </div>
            )}
          </QueueState>
          <ListPagination query={list} />
        </Card>
        <section
          id="ops-selected-case"
          className="ops-case-workspace"
          tabIndex={-1}
          aria-label="Chi tiết báo cáo đang chọn"
        >
          <button
            type="button"
            className="btn admin-mobile-case-back"
            onClick={() => {
              setMobileDetail(false);
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>(
                    ".ops-case-select[aria-pressed='true']",
                  )
                  ?.focus(),
              );
            }}
          >
            ← Quay lại danh sách
          </button>
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
            for (const id of selected) {
              const fresh = await api<ReportCaseDetail>(`reports/${id}`);
              assertReportEditable(fresh.data);
            }
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
            const fresh = await api<ReportCaseDetail>(`reports/${classify.id}`);
            assertReportEditable(fresh.data);
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
          readOnly={list.items.some(
            (row) => row.incidentId === incident && isSystemReport(row),
          )}
        />
      )}
    </section>
  );
}
