"use client";
import { useState } from "react";
import { Card, DataTable, PageHeader } from "@/components/console/ui";
import { LoadingButton } from "@/components/loading-button";
import { fmtDateTime } from "@/lib/console/format";
import { systemCodeLabel } from "@/lib/system-text";
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
import styles from "./audit-logs.module.css";

export function AuditLogsScreen() {
  const [draft, setDraft] = useState(emptyAuditFilters);
  const [filters, setFilters] = useState(emptyAuditFilters);
  const [error, setError] = useState("");
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
  return (
    <section>
      <PageHeader
        title="Nhật ký hoạt động"
        desc="Tra cứu thao tác quản trị và lý do xử lý."
      />
      <Card>
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
                cause instanceof Error ? cause.message : "Kiểm tra lại bộ lọc.",
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
            Mã hành động
            <input
              className="input"
              value={draft.action}
              onChange={(event) => change("action", event.target.value)}
              maxLength={100}
              placeholder="Ví dụ: REPORT_CASE_UPDATE"
            />
          </label>
          <label>
            Loại đối tượng
            <input
              className="input"
              value={draft.targetType}
              onChange={(event) => change("targetType", event.target.value)}
              maxLength={100}
              placeholder="Ví dụ: USER"
            />
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
            <LoadingButton
              className="btn"
              type="button"
              loading={list.loading}
              disabled={list.loading}
              onClick={() => void list.reload()}
            >
              Làm mới
            </LoadingButton>
          </div>
        </form>
        <p className="muted">
          Mã hành động và đối tượng được tìm chính xác. Thời gian nhập theo múi
          giờ thiết bị.
        </p>
        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}
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
                    <UserProfileReference userId={row.actorId} />
                  ) : (
                    row.systemActor ||
                    (row.actorKind === "SYSTEM" ? "Hệ thống" : "Chưa xác định")
                  )}
                  <small>
                    {row.actorRoles
                      .map((role) => systemCodeLabel(role, role))
                      .join(", ") || systemCodeLabel(row.actorRole || "", "")}
                  </small>
                </td>
                <td data-label="Hành động">
                  {systemCodeLabel(row.action, row.action)}
                  <details>
                    <summary>Mã đối chiếu</summary>
                    <RecordId id={row.id} label="nhật ký" />
                    {row.requestId && (
                      <RecordId id={row.requestId} label="yêu cầu" />
                    )}
                    {row.correlationId && (
                      <RecordId id={row.correlationId} label="liên kết" />
                    )}
                  </details>
                </td>
                <td data-label="Đối tượng">
                  {systemCodeLabel(row.targetType, row.targetType)}
                  <div>
                    {row.targetType === "USER" ? (
                      <UserProfileReference userId={row.targetId} />
                    ) : (
                      <RecordId id={row.targetId} label="đối tượng" />
                    )}
                  </div>
                </td>
                <td data-label="Lý do" className={styles.reason}>
                  {row.reason || "Không có ghi chú"}
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
