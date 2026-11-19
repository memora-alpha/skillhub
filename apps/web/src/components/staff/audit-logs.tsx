"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Card, DataTable, PageHeader } from "@/components/console/ui";
import { LoadingButton } from "@/components/loading-button";
import { fmtDateTime } from "@/lib/console/format";
import { Icon } from "@/components/console/icon";
import {
  auditActionLabel,
  auditActionLabels,
  auditFilterOptions,
  auditReasonText,
  auditRoleLabel,
  auditTargetHref,
  auditTargetLabel,
  auditTargetLabels,
  normalizeAuditCode,
} from "@/lib/staff/audit-presentation";
import {
  auditQuery,
  emptyAuditFilters,
  readAuditLogs,
  type AuditFilters,
} from "@/lib/staff/audit-log";
import { QueueState } from "./common";
import { useStaffPagedList } from "./use-staff-paged-list";
import { PageNavigation } from "./page-navigation";
import { RecordId } from "./admin-ui";
import { UserProfileReference } from "./user-profile-reference";
import { EvidenceFileButton } from "./file-preview";
import styles from "./audit-logs.module.css";

export function AuditLogsScreen() {
  const [draft, setDraft] = useState(emptyAuditFilters);
  const [filters, setFilters] = useState(emptyAuditFilters);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const filterId = useId();
  const list = useStaffPagedList<{ id: string }>(
    `audit-logs?${auditQuery(filters)}`,
  );
  let rows: ReturnType<typeof readAuditLogs> = [],
    contractError: string | undefined;
  try {
    rows = readAuditLogs(list.items);
  } catch (cause) {
    contractError =
      cause instanceof Error ? cause.message : "Chưa tải được nhật ký.";
  }
  function change(key: keyof AuditFilters, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  const filterCount = Object.values(filters).filter((value) =>
    value.trim(),
  ).length;
  const actions = auditFilterOptions(
    auditActionLabels,
    [...rows.map((row) => row.action), draft.action, filters.action].filter(
      Boolean,
    ),
  );
  const targets = auditFilterOptions(
    auditTargetLabels,
    [
      ...rows.map((row) => row.targetType),
      draft.targetType,
      filters.targetType,
    ].filter(Boolean),
  );
  return (
    <section>
      <PageHeader
        title="Nhật ký hoạt động"
        desc="Tra cứu thao tác quản trị và lý do xử lý."
      />
      <Card>
        <div className={styles.toolbar}>
          <button
            type="button"
            className="btn"
            aria-expanded={showFilters}
            aria-controls={filterId}
            onClick={() => setShowFilters((previous) => !previous)}
          >
            <Icon name="sliders" size={16} /> Bộ lọc
            {filterCount ? ` (${filterCount})` : ""}
            <Icon
              name="down"
              size={14}
              className={showFilters ? styles.expanded : undefined}
            />
          </button>
          <LoadingButton
            className="btn"
            type="button"
            loading={list.loading}
            disabled={list.loading}
            onClick={() => void list.reload()}
          >
            <Icon name="refresh" size={14} /> Làm mới
          </LoadingButton>
        </div>
        <div id={filterId} hidden={!showFilters}>
          <form
            className={styles.filters}
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const nextQuery = auditQuery(draft).toString();
                setError("");
                if (nextQuery === auditQuery(filters).toString())
                  void list.reload();
                else setFilters({ ...draft });
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Kiểm tra lại bộ lọc.",
                );
              }
            }}
          >
            <label>
              Mã người thực hiện
              <input
                className="input"
                value={draft.actorId}
                onChange={(event) => change("actorId", event.target.value)}
                maxLength={36}
              />
            </label>
            <label>
              Hành động
              <select
                className="select"
                value={draft.action}
                onChange={(event) => change("action", event.target.value)}
              >
                <option value="">Tất cả hành động</option>
                {actions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Loại đối tượng
              <select
                className="select"
                value={draft.targetType}
                onChange={(event) => change("targetType", event.target.value)}
              >
                <option value="">Tất cả đối tượng</option>
                {targets.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mã đối tượng
              <input
                className="input"
                value={draft.targetId}
                onChange={(event) => change("targetId", event.target.value)}
                maxLength={256}
              />
            </label>
            <label>
              Từ thời điểm
              <input
                className="input"
                type="datetime-local"
                value={draft.from}
                onChange={(event) => change("from", event.target.value)}
              />
            </label>
            <label>
              Đến trước thời điểm
              <input
                className="input"
                type="datetime-local"
                value={draft.to}
                onChange={(event) => change("to", event.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={list.loading}
              >
                Áp dụng
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setDraft(emptyAuditFilters);
                  if (
                    auditQuery(filters).toString() ===
                    auditQuery(emptyAuditFilters).toString()
                  )
                    void list.reload();
                  setFilters(emptyAuditFilters);
                  setError("");
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          </form>
          <p className="muted">Thời gian nhập theo múi giờ thiết bị.</p>
          {error && (
            <p className="staff-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <QueueState
          loading={list.loading}
          error={list.error ?? contractError}
          empty={!rows.length}
          reload={() => void list.reload()}
          emptyTitle="Chưa có hoạt động phù hợp"
          emptyDescription="Thử điều chỉnh bộ lọc hoặc khoảng thời gian."
        >
          <DataTable
            columns={[
              "Thời gian",
              "Người thực hiện",
              "Hành động",
              "Đối tượng",
              "Lý do",
            ]}
            className="table admin-responsive-table"
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Thời gian">{fmtDateTime(row.createdAt)}</td>
                <td data-label="Người thực hiện">
                  {row.actorId ? (
                    <UserProfileReference
                      userId={row.actorId}
                      label="người thực hiện"
                    >
                      {row.actorId.slice(0, 8)} · Xem hồ sơ
                    </UserProfileReference>
                  ) : row.actorKind === "SYSTEM" || row.systemActor ? (
                    "Hệ thống tự động"
                  ) : (
                    "Chưa xác định"
                  )}
                  <small className={styles.role}>
                    {[
                      ...new Set(
                        row.actorRoles.length
                          ? row.actorRoles
                          : row.actorRole
                            ? [row.actorRole]
                            : [],
                      ),
                    ]
                      .map(auditRoleLabel)
                      .join(", ")}
                  </small>
                </td>
                <td data-label="Hành động">
                  {auditActionLabel(row.action)}
                  <details>
                    <summary>Mã đối chiếu</summary>
                    <dl className={styles.codes}>
                      <dt>Hành động</dt>
                      <dd>
                        <code>{row.action}</code>
                      </dd>
                      <dt>Loại đối tượng</dt>
                      <dd>
                        <code>{row.targetType}</code>
                      </dd>
                      {row.systemActor && (
                        <>
                          <dt>Tiến trình</dt>
                          <dd>
                            <code>{row.systemActor}</code>
                          </dd>
                        </>
                      )}
                    </dl>
                    <RecordId id={row.id} label="nhật ký" />
                    {row.actorId && (
                      <RecordId id={row.actorId} label="người thực hiện" />
                    )}
                    {row.requestId && (
                      <RecordId id={row.requestId} label="yêu cầu" />
                    )}
                    {row.correlationId && (
                      <RecordId id={row.correlationId} label="liên kết" />
                    )}
                  </details>
                </td>
                <td data-label="Đối tượng">
                  <AuditTarget type={row.targetType} id={row.targetId} />
                </td>
                <td data-label="Lý do" className={styles.reason}>
                  {auditReasonText(row.reason)}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueueState>
        {!contractError && !list.error && (
          <PageNavigation
            pageNumber={list.pageNumber}
            totalPages={list.totalPages}
            hasNext={!!list.page?.hasMore}
            loading={list.loading}
            onPageChange={(page) => void list.goToPage(page)}
          />
        )}
      </Card>
    </section>
  );
}

function AuditTarget({ type, id }: Readonly<{ type: string; id: string }>) {
  const code = normalizeAuditCode(type);
  const href = auditTargetHref(type, id);
  return (
    <div className={styles.target}>
      <span>{auditTargetLabel(type)}</span>
      {code === "USER" ? (
        <UserProfileReference userId={id}>Xem hồ sơ</UserProfileReference>
      ) : (
        <>
          {href && (
            <Link className="link" href={href} prefetch={false}>
              {code === "REPORT_CASE" ? "Xem báo cáo" : "Xem lộ trình"}
            </Link>
          )}
          {code === "REPORT_EVIDENCE" &&
            /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) && (
              <EvidenceFileButton
                path={`reports/evidence/${id}/download`}
                name="Bằng chứng báo cáo"
              />
            )}
        </>
      )}
      <RecordId id={id} label="đối tượng" />
    </div>
  );
}
