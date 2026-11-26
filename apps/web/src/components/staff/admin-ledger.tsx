"use client";
import { LoadingButton } from "@/components/loading-button";

import { useState } from "react";
import { UserProfileReference } from "./user-profile-reference";
import Link from "next/link";
import { Card, DataTable, StatusBadge } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { fmtDateTime } from "@/lib/console/format";
import { financeLabel, financeNumber } from "@/lib/staff/finance-presentation";
import {
  readLedgerEntry,
  readLedgerOperation,
  type LedgerEntry,
  type LedgerOperation,
} from "@/lib/staff/ledger-view";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import { AdminFilterPanel, filterPanelStyles } from "./admin-filter-panel";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { useStaffPagedList } from "./use-staff-paged-list";
import { PageNavigation } from "./page-navigation";
import {
  emptyLedgerFilters,
  ledgerHref,
  ledgerQuery,
  ledgerReferenceHref,
  ledgerReferenceTypes,
  type LedgerFilters,
} from "@/lib/staff/ledger-query";

const transactionTypes = [
  "TOP_UP",
  "VOUCHER_REDEMPTION",
  "DAILY_BONUS",
  "FEEDBACK_BONUS",
  "HOLD",
  "RELEASE",
  "PATH_RETURN",
  "PLATFORM_FEE",
  "TEACHING_PAYMENT",
  "TEACHING_EARNING",
  "MATERIAL_PURCHASE",
  "MATERIAL_SALE",
  "REFUND",
  "PENALTY",
  "ADJUSTMENT",
];
const money = (value: string) => financeNumber(value) + " CR";
type Selection = { id: string; kind: "entry" | "operation" };

export function AdminLedgerScreen({
  initialFilters = emptyLedgerFilters,
}: Readonly<{ initialFilters?: LedgerFilters }>) {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(() => {
    try {
      ledgerQuery(initialFilters);
      return initialFilters;
    } catch {
      return emptyLedgerFilters;
    }
  });
  const [filterError, setFilterError] = useState<string>(() => {
    try {
      ledgerQuery(initialFilters);
      return "";
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.";
    }
  });
  const [selected, setSelected] = useState<Selection | undefined>(() => {
    try {
      ledgerQuery(initialFilters);
      return initialFilters.transactionId
        ? { id: initialFilters.transactionId, kind: "entry" }
        : undefined;
    } catch {
      return undefined;
    }
  });
  const params = ledgerQuery(filters);
  const list = useStaffPagedList<LedgerEntry>("credit/transactions?" + params);
  let entries: LedgerEntry[] = [];
  let invalid: string | undefined;
  try {
    entries = list.items.map(readLedgerEntry);
  } catch {
    invalid =
      "Chưa đọc được đầy đủ dữ liệu giao dịch. Hãy làm mới danh sách trước khi xem chi tiết.";
  }
  function clear() {
    setDraft(emptyLedgerFilters);
    setFilters(emptyLedgerFilters);
    setFilterError("");
    setSelected(undefined);
    window.history.replaceState(null, "", ledgerHref(emptyLedgerFilters));
  }
  function update(key: keyof LedgerFilters, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function apply() {
    try {
      const next = Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [key, value.trim()]),
      ) as LedgerFilters;
      ledgerQuery(next);
      setFilters(next);
      setFilterError("");
      setSelected(
        next.transactionId
          ? { id: next.transactionId, kind: "entry" }
          : undefined,
      );
      window.history.replaceState(null, "", ledgerHref(next));
    } catch (cause) {
      setFilterError(
        cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.",
      );
    }
  }
  const activeFilterCount = Object.values(filters).filter((value) =>
    value.trim(),
  ).length;
  return (
    <div className="admin-ledger">
      <AdminFilterPanel
        activeCount={activeFilterCount}
        onClear={clear}
        actions={
          <LoadingButton
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => {
              setSelected(undefined);
              void list.reload();
            }}
            loading={!!list.loading}
          >
            <Icon name="refresh" size={16} />
            Làm mới
          </LoadingButton>
        }
      >
        <form
          className={filterPanelStyles.grid}
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <label className={filterPanelStyles.field}>
            <span>Mã người dùng</span>
            <input
              value={draft.userId}
              maxLength={36}
              placeholder="Nhập mã UUID người dùng…"
              onChange={(event) => update("userId", event.target.value)}
            />
          </label>
          <label className={filterPanelStyles.field}>
            <span>Loại giao dịch</span>
            <select
              value={draft.type}
              onChange={(event) => {
                update("type", event.target.value);
              }}
            >
              <option value="">Tất cả loại</option>
              {transactionTypes.map((value) => (
                <option key={value} value={value}>
                  {financeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className={filterPanelStyles.field}>
            <span>Trạng thái</span>
            <select
              value={draft.status}
              onChange={(event) => {
                update("status", event.target.value);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {["PENDING", "SUCCESS", "FAILED", "REVERSED"].map((value) => (
                <option key={value} value={value}>
                  {
                    (
                      {
                        PENDING: "Đang xử lý",
                        SUCCESS: "Thành công",
                        FAILED: "Thất bại",
                        REVERSED: "Đã đảo",
                      } as Record<string, string>
                    )[value]
                  }
                </option>
              ))}
            </select>
          </label>
          <label className={filterPanelStyles.field}>
            <span>Từ thời điểm (UTC)</span>
            <input
              type="datetime-local"
              value={draft.from}
              onChange={(event) => update("from", event.target.value)}
            />
          </label>
          <label className={filterPanelStyles.field}>
            <span>Trước thời điểm (UTC)</span>
            <input
              type="datetime-local"
              value={draft.before}
              onChange={(event) => update("before", event.target.value)}
            />
          </label>
          <label className={filterPanelStyles.field}>
            <span>Mã nghiệp vụ</span>
            <input
              maxLength={36}
              value={draft.operationId}
              onChange={(event) => update("operationId", event.target.value)}
            />
          </label>
          <label className={filterPanelStyles.field}>
            <span>Nguồn tham chiếu</span>
            <select
              value={draft.referenceType}
              onChange={(event) => update("referenceType", event.target.value)}
            >
              <option value="">Tất cả nguồn</option>
              {ledgerReferenceTypes.map((value) => (
                <option key={value} value={value}>
                  {financeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className={filterPanelStyles.field}>
            <span>Mã tham chiếu</span>
            <input
              maxLength={255}
              value={draft.referenceId}
              onChange={(event) => update("referenceId", event.target.value)}
            />
          </label>
          <label className={filterPanelStyles.field}>
            <span>Mở giao dịch theo mã</span>
            <input
              maxLength={36}
              value={draft.transactionId}
              onChange={(event) => update("transactionId", event.target.value)}
            />
          </label>
          <div className={filterPanelStyles.footer}>
            <p className={filterPanelStyles.note}>
              Số dư được ghi nhận tại thời điểm giao dịch. Nhập mã giao dịch để
              mở chi tiết trực tiếp.
            </p>
            <div className={filterPanelStyles.footerActions}>
              <button type="submit" className="btn btn-primary btn-sm">
                Áp dụng / Tra cứu
              </button>
              {Object.values(draft).some(Boolean) && (
                <button type="button" className="btn btn-sm" onClick={clear}>
                  Xóa lọc
                </button>
              )}
            </div>
          </div>
        </form>
      </AdminFilterPanel>
      {filterError && (
        <p role="alert" className="staff-error">
          {filterError}
        </p>
      )}
      <Card flush>
        <QueueState
          loading={list.loading}
          error={list.error ?? invalid}
          empty={!entries.length}
          reload={list.reload}
          emptyTitle="Chưa có giao dịch phù hợp"
          emptyDescription="Thử bỏ bộ lọc hoặc kiểm tra lại mã người dùng."
        >
          <DataTable
            columns={[
              "Thời gian / Người dùng",
              "Loại / Trạng thái",
              "Số Credit",
              "Biến động",
              "Số dư sau giao dịch",
              "Thao tác",
            ]}
            className="table admin-responsive-table admin-ledger-table"
          >
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td data-label="Thời gian / Người dùng">
                  <strong>{fmtDateTime(entry.createdAt)}</strong>
                  <div>
                    <UserProfileReference userId={entry.userId} />
                  </div>
                </td>
                <td data-label="Loại / Trạng thái">
                  <strong>{financeLabel(entry.type)}</strong>
                  <div>
                    <StatusBadge status={entry.status} />
                  </div>
                </td>
                <td data-label="Số Credit">
                  <strong className="admin-money">{money(entry.amount)}</strong>
                </td>
                <td data-label="Biến động">
                  <span>
                    Khả dụng{" "}
                    <strong className="admin-money">
                      {money(entry.availableDelta)}
                    </strong>
                  </span>
                  <small>
                    Đang giữ{" "}
                    <span className="admin-money">
                      {money(entry.heldDelta)}
                    </span>
                  </small>
                </td>
                <td data-label="Số dư sau giao dịch">
                  <span>
                    Khả dụng{" "}
                    <strong className="admin-money">
                      {money(entry.availableAfter)}
                    </strong>
                  </span>
                  <small>
                    Đang giữ{" "}
                    <span className="admin-money">
                      {money(entry.heldAfter)}
                    </span>
                  </small>
                </td>
                <td data-label="Thao tác">
                  <div className="admin-ledger-actions">
                    <button
                      type="button"
                      className="link ops-text-button"
                      onClick={() =>
                        setSelected({ id: entry.id, kind: "entry" })
                      }
                    >
                      Chi tiết
                    </button>
                    <button
                      type="button"
                      className="link ops-text-button"
                      onClick={() =>
                        setSelected({
                          id: entry.operationId,
                          kind: "operation",
                        })
                      }
                    >
                      Nghiệp vụ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueueState>
        <PageNavigation
          loading={list.loading}
          pageNumber={list.pageNumber}
          totalPages={list.totalPages}
          hasNext={list.page?.hasMore ?? false}
          onPageChange={(page) => {
            setSelected(undefined);
            void list.goToPage(page);
          }}
        />
      </Card>
      {selected && !list.error && !invalid && (
        <LedgerDetail
          key={selected.kind + selected.id}
          selection={selected}
          close={() => setSelected(undefined)}
        />
      )}
    </div>
  );
}

function EntryPresentation({ entry }: Readonly<{ entry: LedgerEntry }>) {
  return (
    <>
      <div className="admin-hero-amount">
        <span>{financeLabel(entry.type)}</span>
        <strong className="admin-money">{money(entry.amount)}</strong>
        <StatusBadge status={entry.status} />
      </div>
      <div className="admin-metric-grid">
        <AdminField label="Biến động khả dụng">
          <span className="admin-money">{money(entry.availableDelta)}</span>
        </AdminField>
        <AdminField label="Biến động đang giữ">
          <span className="admin-money">{money(entry.heldDelta)}</span>
        </AdminField>
        <AdminField label="Khả dụng sau giao dịch">
          <span className="admin-money">{money(entry.availableAfter)}</span>
        </AdminField>
        <AdminField label="Đang giữ sau giao dịch">
          <span className="admin-money">{money(entry.heldAfter)}</span>
        </AdminField>
      </div>
      <section className="admin-section">
        <h3>Nghiệp vụ liên quan</h3>
        <div className="admin-field-grid">
          <AdminField label="Loại nghiệp vụ">
            {financeLabel(entry.operationIdRecord.operationType)}
          </AdminField>
          <AdminField label="Nguồn tham chiếu">
            {financeLabel(entry.operationIdRecord.referenceType)}
          </AdminField>
          <AdminField label="Mã nghiệp vụ">
            <RecordId id={entry.operationId} label="nghiệp vụ" />
          </AdminField>
          <AdminField label="Mã tham chiếu">
            <RecordId
              id={entry.operationIdRecord.referenceId}
              label="tham chiếu"
            />
          </AdminField>
          <AdminField label="Thời gian giao dịch">
            {fmtDateTime(entry.createdAt)}
          </AdminField>
        </div>
      </section>
      <details className="admin-record-details">
        <summary>Mã đối chiếu</summary>
        <div className="admin-field-grid">
          <AdminField label="Giao dịch">
            <RecordId id={entry.id} label="giao dịch" />
          </AdminField>
          <AdminField label="Người dùng">
            <UserProfileReference userId={entry.userId} />
          </AdminField>
          {entry.reversesTransactionId && (
            <AdminField label="Giao dịch được đảo">
              <RecordId
                id={entry.reversesTransactionId}
                label="giao dịch được đảo"
              />
            </AdminField>
          )}
        </div>
      </details>
      <div className="row">
        <UserProfileReference userId={entry.userId} className="btn">
          Hồ sơ người dùng
        </UserProfileReference>
        <Link
          className="btn"
          href={`/admin/credits?tab=wallet&userId=${entry.userId}`}
        >
          Xem ví
        </Link>
        <ReferenceLink
          type={entry.operationIdRecord.referenceType}
          id={entry.operationIdRecord.referenceId}
        />
      </div>
    </>
  );
}
function OperationPresentation({
  operation,
}: Readonly<{ operation: LedgerOperation }>) {
  return (
    <>
      <section className="admin-section">
        <div className="row">
          <h3>{financeLabel(operation.operationType)}</h3>
          <StatusBadge status={operation.status} />
        </div>
        <div className="admin-field-grid">
          <AdminField label="Nghiệp vụ">
            <RecordId id={operation.id} label="nghiệp vụ" />
          </AdminField>
          <AdminField label="Thời gian">
            {fmtDateTime(operation.createdAt)}
          </AdminField>
          <AdminField label="Nguồn tham chiếu">
            {financeLabel(operation.referenceType)}
          </AdminField>
          <AdminField label="Mã tham chiếu">
            <RecordId id={operation.referenceId} label="tham chiếu" />
          </AdminField>
        </div>
      </section>
      <ReferenceLink
        type={operation.referenceType}
        id={operation.referenceId}
      />
      <section className="admin-section">
        <h3>Các bút toán liên quan</h3>
        {operation.entries.length ? (
          <DataTable
            columns={["Người dùng", "Loại / Trạng thái", "Credit", "Biến động"]}
            className="table admin-responsive-table"
          >
            {operation.entries.map((entry) => (
              <tr key={entry.id}>
                <td data-label="Người dùng">
                  <UserProfileReference userId={entry.userId} />
                </td>
                <td data-label="Loại / Trạng thái">
                  {financeLabel(entry.type)}
                  <div>
                    <StatusBadge status={entry.status} />
                  </div>
                </td>
                <td data-label="Credit" className="admin-money">
                  {money(entry.amount)}
                </td>
                <td data-label="Biến động">
                  <span>Khả dụng {money(entry.availableDelta)}</span>
                  <small>Đang giữ {money(entry.heldDelta)}</small>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <p className="muted">Nghiệp vụ chưa có bút toán.</p>
        )}
      </section>
    </>
  );
}
function ReferenceLink({ type, id }: Readonly<{ type: string; id: string }>) {
  const href = ledgerReferenceHref(type, id);
  return href ? (
    <Link className="btn" href={href}>
      Mở {financeLabel(type).toLocaleLowerCase("vi")} liên quan
    </Link>
  ) : null;
}
function LedgerDetail({
  selection,
  close,
}: Readonly<{ selection: Selection; close: () => void }>) {
  const query = useStaffResource<unknown>(
    `credit/${selection.kind === "entry" ? "transactions" : "operations"}/${selection.id}`,
  );
  let entry: LedgerEntry | undefined;
  let operation: LedgerOperation | undefined;
  let invalid = false;
  if (query.data) {
    try {
      if (selection.kind === "entry") {
        entry = readLedgerEntry(query.data);
        invalid = entry.id !== selection.id;
      } else {
        operation = readLedgerOperation(query.data);
        invalid = operation.id !== selection.id;
      }
    } catch {
      invalid = true;
    }
  }
  return (
    <AdminDrawer
      title={
        selection.kind === "entry" ? "Chi tiết giao dịch" : "Chi tiết nghiệp vụ"
      }
      subtitle={
        <RecordId
          id={selection.id}
          label={selection.kind === "entry" ? "giao dịch" : "nghiệp vụ"}
        />
      }
      close={close}
      footer={
        <button type="button" className="btn" onClick={close}>
          Đóng
        </button>
      }
    >
      <QueueState
        loading={query.loading}
        error={query.error}
        empty={!query.data}
        reload={query.reload}
      >
        {invalid ? (
          <AdminNotice tone="bad">
            <strong>Chưa đọc được chi tiết giao dịch</strong>
            <p>
              Dữ liệu chưa đầy đủ hoặc đã thay đổi. Vui lòng tải lại trước khi
              đối chiếu.
            </p>
            <button type="button" className="btn" onClick={query.reload}>
              Tải lại chi tiết
            </button>
          </AdminNotice>
        ) : (
          <>
            {entry && <EntryPresentation entry={entry} />}
            {operation && <OperationPresentation operation={operation} />}
          </>
        )}
      </QueueState>
    </AdminDrawer>
  );
}
