"use client";
import { LoadingButton } from "@/components/loading-button";
import { useId, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { fmtDateTime } from "@/lib/console/format";
import {
  creditDirection,
  financeLabel,
  financeNumber,
  formatSignedCredit,
} from "@/lib/staff/finance-presentation";
import {
  readLedgerEntry,
  readLedgerOperation,
  type LedgerEntry,
  type LedgerOperation,
} from "@/lib/staff/ledger-view";
import { AdminDrawer, AdminField, AdminNotice, RecordId } from "./admin-ui";
import {
  AdminFilterPanel,
  AdminFilterTrigger,
  filterPanelStyles,
} from "./admin-filter-panel";
import { QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { useStaffPagedList } from "./use-staff-paged-list";
import { PageNavigation } from "./page-navigation";
import { UserProfileReference } from "./user-profile-reference";
import {
  emptyLedgerFilters,
  ledgerHref,
  ledgerQuery,
  ledgerReferenceHref,
  ledgerReferenceTypes,
  type LedgerFilters,
} from "@/lib/staff/ledger-query";
import styles from "./admin-finance.module.css";

const transactionTypes = [
  "TOP_UP",
  "SUBSCRIPTION_PURCHASE",
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
] as const;

const statusOptions = [
  { value: "SUCCESS", label: "Thành công" },
  { value: "PENDING", label: "Đang xử lý" },
  { value: "FAILED", label: "Thất bại" },
  { value: "REVERSED", label: "Đã đảo" },
] as const;

const statusLabelMap: Record<string, string> = Object.fromEntries(
  statusOptions.map((item) => [item.value, item.label]),
);

const advancedKeys: readonly (keyof LedgerFilters)[] = [
  "from",
  "before",
  "operationId",
  "referenceType",
  "referenceId",
  "transactionId",
];

const money = (value: string) => `${financeNumber(value)} CR`;

function shortCode(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function deltaToneClass(value: string, held = false) {
  const dir = creditDirection(value);
  if (dir === "zero") return styles.deltaZero;
  if (held) return styles.deltaHeld;
  return dir === "positive" ? styles.deltaPositive : styles.deltaNegative;
}

type Selection = { id: string; kind: "entry" | "operation" };

export function AdminLedgerScreen({
  initialFilters = emptyLedgerFilters,
  onOpenWallet,
}: Readonly<{
  initialFilters?: LedgerFilters;
  onOpenWallet?: (userId: string) => void;
}>) {
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
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    advancedKeys.some((key) => Boolean(initialFilters[key].trim())),
  );
  const filterPanelId = useId();

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

  function commitFilters(nextDraft: LedgerFilters) {
    try {
      const next = Object.fromEntries(
        Object.entries(nextDraft).map(([key, value]) => [key, value.trim()]),
      ) as LedgerFilters;
      ledgerQuery(next);
      setDraft(next);
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

  function clearAll() {
    setDraft(emptyLedgerFilters);
    setFilters(emptyLedgerFilters);
    setFilterError("");
    setSelected(undefined);
    window.history.replaceState(null, "", ledgerHref(emptyLedgerFilters));
  }

  function removeFilter(key: keyof LedgerFilters) {
    const next = { ...filters, [key]: "" };
    commitFilters(next);
  }

  function updateDraft(key: keyof LedgerFilters, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  const advancedActiveCount = advancedKeys.filter((key) =>
    filters[key].trim(),
  ).length;

  const activeTags: { key: keyof LedgerFilters; label: string }[] = [];
  if (filters.type)
    activeTags.push({
      key: "type",
      label: `Loại: ${financeLabel(filters.type)}`,
    });
  if (filters.status)
    activeTags.push({
      key: "status",
      label: `Trạng thái: ${statusLabelMap[filters.status] ?? filters.status}`,
    });
  if (filters.userId)
    activeTags.push({
      key: "userId",
      label: `Người dùng: ${shortCode(filters.userId)}`,
    });
  if (filters.from)
    activeTags.push({ key: "from", label: `Từ: ${filters.from} UTC` });
  if (filters.before)
    activeTags.push({ key: "before", label: `Trước: ${filters.before} UTC` });
  if (filters.operationId)
    activeTags.push({
      key: "operationId",
      label: `Nghiệp vụ: ${shortCode(filters.operationId)}`,
    });
  if (filters.referenceType)
    activeTags.push({
      key: "referenceType",
      label: `Nguồn: ${financeLabel(filters.referenceType)}`,
    });
  if (filters.referenceId)
    activeTags.push({
      key: "referenceId",
      label: `Tham chiếu: ${shortCode(filters.referenceId)}`,
    });
  if (filters.transactionId)
    activeTags.push({
      key: "transactionId",
      label: `Giao dịch: ${shortCode(filters.transactionId)}`,
    });

  return (
    <section
      className={styles.sectionCard}
      aria-label="Sổ cái giao dịch Credit"
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <h2>Sổ cái giao dịch Credit</h2>
          <p>
            Theo dõi từng bút toán bất biến, biến động khả dụng/tạm giữ và đối
            chiếu nghiệp vụ nguồn.
          </p>
        </div>
        <div className={styles.cardHeaderActions}>
          <AdminFilterTrigger
            label="Lọc nâng cao"
            activeCount={advancedActiveCount}
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((prev) => !prev)}
            onClear={activeTags.length > 0 ? clearAll : undefined}
            panelId={filterPanelId}
          />
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
            <Icon name="refresh" size={15} />
            Làm mới
          </LoadingButton>
        </div>
      </div>

      {/* Quick toolbar for the most frequent filters */}
      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          commitFilters(draft);
        }}
      >
        <div className={styles.toolbarFields}>
          <label className={styles.quickField}>
            <span>Loại giao dịch</span>
            <select
              value={draft.type}
              onChange={(event) => {
                const next = { ...draft, type: event.target.value };
                setDraft(next);
                commitFilters(next);
              }}
            >
              <option value="">Tất cả loại giao dịch</option>
              {transactionTypes.map((value) => (
                <option key={value} value={value}>
                  {financeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.quickField}>
            <span>Trạng thái</span>
            <select
              value={draft.status}
              onChange={(event) => {
                const next = { ...draft, status: event.target.value };
                setDraft(next);
                commitFilters(next);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.quickField} ${styles.quickFieldWide}`}>
            <span>Mã người dùng (UUID)</span>
            <input
              value={draft.userId}
              maxLength={36}
              placeholder="Dán UUID người dùng rồi nhấn Tra cứu…"
              onChange={(event) => updateDraft("userId", event.target.value)}
            />
          </label>
        </div>
        <div className={styles.toolbarActions}>
          <button type="submit" className="btn btn-primary">
            <Icon name="search" size={15} />
            Tra cứu
          </button>
          {activeTags.length > 0 && (
            <button type="button" className="btn" onClick={clearAll}>
              Xóa lọc
            </button>
          )}
        </div>
      </form>

      {/* Expandable advanced filters */}
      {advancedOpen && (
        <div className={styles.advancedDrawer}>
          <AdminFilterPanel
            hideBar
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
            panelId={filterPanelId}
          >
            <form
              className={filterPanelStyles.grid}
              onSubmit={(event) => {
                event.preventDefault();
                commitFilters(draft);
              }}
            >
              <label className={filterPanelStyles.field}>
                <span>Từ thời điểm (UTC)</span>
                <input
                  type="datetime-local"
                  value={draft.from}
                  onChange={(event) => updateDraft("from", event.target.value)}
                />
              </label>
              <label className={filterPanelStyles.field}>
                <span>Trước thời điểm (UTC)</span>
                <input
                  type="datetime-local"
                  value={draft.before}
                  onChange={(event) =>
                    updateDraft("before", event.target.value)
                  }
                />
              </label>
              <label className={filterPanelStyles.field}>
                <span>Mã nghiệp vụ (UUID)</span>
                <input
                  maxLength={36}
                  placeholder="xxxxxxxx-xxxx-…"
                  value={draft.operationId}
                  onChange={(event) =>
                    updateDraft("operationId", event.target.value)
                  }
                />
              </label>
              <label className={filterPanelStyles.field}>
                <span>Nguồn tham chiếu</span>
                <select
                  value={draft.referenceType}
                  onChange={(event) =>
                    updateDraft("referenceType", event.target.value)
                  }
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
                  placeholder="Nhập mã đối tượng liên quan…"
                  value={draft.referenceId}
                  onChange={(event) =>
                    updateDraft("referenceId", event.target.value)
                  }
                />
              </label>
              <label className={filterPanelStyles.field}>
                <span>Mở thẳng giao dịch theo mã</span>
                <input
                  maxLength={36}
                  placeholder="UUID giao dịch…"
                  value={draft.transactionId}
                  onChange={(event) =>
                    updateDraft("transactionId", event.target.value)
                  }
                />
              </label>
              <div className={filterPanelStyles.footer}>
                <p className={filterPanelStyles.note}>
                  Số dư được ghi nhận chính xác tại thời điểm bút toán phát
                  sinh. Nhập mã giao dịch để mở nhanh chi tiết.
                </p>
                <div className={filterPanelStyles.footerActions}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Áp dụng bộ lọc
                  </button>
                  {Object.values(draft).some((v) => v.trim()) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={clearAll}
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>
            </form>
          </AdminFilterPanel>
        </div>
      )}

      {/* Active filter tags */}
      {activeTags.length > 0 && (
        <div className={styles.activeFiltersBar} aria-label="Bộ lọc đang bật">
          <span className={styles.activeFilterLabel}>Đang lọc:</span>
          {activeTags.map((tag) => (
            <span key={tag.key} className={styles.activeFilterTag}>
              <span>{tag.label}</span>
              <button
                type="button"
                className={styles.activeFilterRemove}
                aria-label={`Bỏ bộ lọc ${tag.label}`}
                onClick={() => removeFilter(tag.key)}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className={styles.clearAllLink}
            onClick={clearAll}
          >
            Xóa tất cả
          </button>
        </div>
      )}

      {filterError && (
        <p role="alert" className={`staff-error ${styles.inlineError}`}>
          {filterError}
        </p>
      )}

      <QueueState
        loading={list.loading}
        error={list.error ?? invalid}
        empty={!entries.length}
        reload={list.reload}
        emptyTitle="Chưa có giao dịch phù hợp"
        emptyDescription="Thử điều chỉnh bộ lọc hoặc xóa các tiêu chí đang chọn để xem toàn bộ sổ cái."
      >
        {/* Desktop Table */}
        <div className={styles.desktopTableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">Thời gian / Người dùng</th>
                <th scope="col">Loại / Trạng thái</th>
                <th scope="col" className={styles.numHead}>
                  Số Credit
                </th>
                <th scope="col" className={styles.numHead}>
                  Biến động
                </th>
                <th scope="col" className={styles.numHead}>
                  Số dư sau GD
                </th>
                <th scope="col" className={styles.actionHead}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div className={styles.primaryStack}>
                      <strong>{fmtDateTime(entry.createdAt)}</strong>
                      <UserProfileReference userId={entry.userId} />
                    </div>
                  </td>
                  <td>
                    <div className={styles.typeCell}>
                      <span className={styles.typeTitle}>
                        {financeLabel(entry.type)}
                      </span>
                      <StatusBadge status={entry.status} />
                    </div>
                  </td>
                  <td className={styles.numCell}>
                    <span className={styles.amountPrimary}>
                      {money(entry.amount)}
                    </span>
                  </td>
                  <td className={styles.numCell}>
                    <div className={styles.deltaStack}>
                      <span className={styles.deltaLine}>
                        <span className={styles.deltaLabel}>Khả dụng</span>
                        <span className={deltaToneClass(entry.availableDelta)}>
                          {formatSignedCredit(entry.availableDelta)}
                        </span>
                      </span>
                      <span className={styles.deltaLine}>
                        <span className={styles.deltaLabel}>Đang giữ</span>
                        <span className={deltaToneClass(entry.heldDelta, true)}>
                          {formatSignedCredit(entry.heldDelta)}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.numCell}>
                    <div className={styles.deltaStack}>
                      <span className={styles.deltaLine}>
                        <span className={styles.deltaLabel}>Khả dụng</span>
                        <strong>{money(entry.availableAfter)}</strong>
                      </span>
                      <span className={styles.deltaLine}>
                        <span className={styles.deltaLabel}>Đang giữ</span>
                        <span className={styles.metaText}>
                          {money(entry.heldAfter)}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className={styles.actionCell}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setSelected({ id: entry.id, kind: "entry" })
                        }
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
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
            </tbody>
          </table>
        </div>

        {/* Tablet & Mobile Card Grid */}
        <div className={styles.mobileCards}>
          {entries.map((entry) => (
            <article key={entry.id} className={styles.itemCard}>
              <div className={styles.itemCardHead}>
                <div className={styles.itemCardTitle}>
                  <strong>{financeLabel(entry.type)}</strong>
                  <div>
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
                <div className={styles.itemCardAmount}>
                  <span className={styles.amountPrimary}>
                    {money(entry.amount)}
                  </span>
                </div>
              </div>

              <div className={styles.itemCardMetaRow}>
                <span>{fmtDateTime(entry.createdAt)}</span>
                <UserProfileReference userId={entry.userId} />
              </div>

              <div className={styles.itemCardMetrics}>
                <div className={styles.itemCardMetricCol}>
                  <span className={styles.itemCardMetricLabel}>Biến động</span>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Khả dụng</span>
                    <span className={deltaToneClass(entry.availableDelta)}>
                      {formatSignedCredit(entry.availableDelta)}
                    </span>
                  </span>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Đang giữ</span>
                    <span className={deltaToneClass(entry.heldDelta, true)}>
                      {formatSignedCredit(entry.heldDelta)}
                    </span>
                  </span>
                </div>
                <div className={styles.itemCardMetricCol}>
                  <span className={styles.itemCardMetricLabel}>
                    Số dư sau GD
                  </span>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Khả dụng</span>
                    <strong>{money(entry.availableAfter)}</strong>
                  </span>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Đang giữ</span>
                    <span className={styles.metaText}>
                      {money(entry.heldAfter)}
                    </span>
                  </span>
                </div>
              </div>

              <div className={styles.itemCardFoot}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelected({ id: entry.id, kind: "entry" })}
                >
                  Chi tiết giao dịch
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
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
            </article>
          ))}
        </div>
      </QueueState>

      <div className={styles.footerWrap}>
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
      </div>

      {selected && !list.error && !invalid && (
        <LedgerDetail
          key={selected.kind + selected.id}
          selection={selected}
          onSelect={setSelected}
          onOpenWallet={onOpenWallet}
          close={() => setSelected(undefined)}
        />
      )}
    </section>
  );
}

function EntryPresentation({
  entry,
  onSelectOperation,
  onOpenWallet,
}: Readonly<{
  entry: LedgerEntry;
  onSelectOperation: (operationId: string) => void;
  onOpenWallet?: (userId: string) => void;
}>) {
  return (
    <>
      <div className={styles.drawerHero}>
        <div className={styles.drawerHeroTop}>
          <span className={styles.drawerHeroEyebrow}>
            {financeLabel(entry.type)}
          </span>
          <StatusBadge status={entry.status} />
        </div>
        <strong className={styles.drawerHeroValue}>
          {money(entry.amount)}
        </strong>
        <div className={styles.drawerHeroSub}>
          <span>{fmtDateTime(entry.createdAt)}</span>
          <span>·</span>
          <UserProfileReference userId={entry.userId} />
        </div>
      </div>

      <div className={styles.drawerMetrics}>
        <div className={styles.drawerMetricBox}>
          <span>Biến động khả dụng</span>
          <strong className={deltaToneClass(entry.availableDelta)}>
            {formatSignedCredit(entry.availableDelta)}
          </strong>
        </div>
        <div className={styles.drawerMetricBox}>
          <span>Biến động đang giữ</span>
          <strong className={deltaToneClass(entry.heldDelta, true)}>
            {formatSignedCredit(entry.heldDelta)}
          </strong>
        </div>
        <div className={styles.drawerMetricBox}>
          <span>Khả dụng sau giao dịch</span>
          <strong>{money(entry.availableAfter)}</strong>
        </div>
        <div className={styles.drawerMetricBox}>
          <span>Đang giữ sau giao dịch</span>
          <strong>{money(entry.heldAfter)}</strong>
        </div>
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
        </div>
      </section>

      <details className="admin-record-details">
        <summary>Mã đối chiếu kỹ thuật</summary>
        <div className="admin-field-grid">
          <AdminField label="Mã giao dịch">
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

      <section className="admin-section">
        <div className={styles.quickNavRow}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSelectOperation(entry.operationId)}
          >
            Xem toàn bộ nghiệp vụ
          </button>
          <UserProfileReference userId={entry.userId} className="btn btn-sm">
            Hồ sơ người dùng
          </UserProfileReference>
          {onOpenWallet ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onOpenWallet(entry.userId)}
            >
              Xem ví
            </button>
          ) : (
            <Link
              className="btn btn-sm"
              href={`/admin/credits?tab=wallet&userId=${entry.userId}`}
            >
              Xem ví
            </Link>
          )}
          <ReferenceLink
            type={entry.operationIdRecord.referenceType}
            id={entry.operationIdRecord.referenceId}
          />
        </div>
      </section>
    </>
  );
}

function OperationPresentation({
  operation,
  onSelectEntry,
}: Readonly<{
  operation: LedgerOperation;
  onSelectEntry: (entryId: string) => void;
}>) {
  return (
    <>
      <div className={styles.drawerHero}>
        <div className={styles.drawerHeroTop}>
          <span className={styles.drawerHeroEyebrow}>Nghiệp vụ Credit</span>
          <StatusBadge status={operation.status} />
        </div>
        <strong className={styles.drawerHeroValue}>
          {financeLabel(operation.operationType)}
        </strong>
        <div className={styles.drawerHeroSub}>
          <span>{fmtDateTime(operation.createdAt)}</span>
          <span>·</span>
          <span>{operation.entries.length} bút toán</span>
        </div>
      </div>

      <section className="admin-section">
        <h3>Thông tin nguồn</h3>
        <div className="admin-field-grid">
          <AdminField label="Mã nghiệp vụ">
            <RecordId id={operation.id} label="nghiệp vụ" />
          </AdminField>
          <AdminField label="Nguồn tham chiếu">
            {financeLabel(operation.referenceType)}
          </AdminField>
          <AdminField label="Mã tham chiếu">
            <RecordId id={operation.referenceId} label="tham chiếu" />
          </AdminField>
        </div>
        <div className={styles.quickNavRow} style={{ marginTop: 14 }}>
          <ReferenceLink
            type={operation.referenceType}
            id={operation.referenceId}
          />
        </div>
      </section>

      <section className="admin-section">
        <h3>Các bút toán trong nghiệp vụ</h3>
        {operation.entries.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {operation.entries.map((entry) => (
              <div key={entry.id} className={styles.itemCard}>
                <div className={styles.itemCardHead}>
                  <div className={styles.itemCardTitle}>
                    <strong>{financeLabel(entry.type)}</strong>
                    <UserProfileReference userId={entry.userId} />
                  </div>
                  <div className={styles.itemCardAmount}>
                    <span className={styles.amountPrimary}>
                      {money(entry.amount)}
                    </span>
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
                <div className={styles.itemCardMetaRow}>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Khả dụng:</span>
                    <span className={deltaToneClass(entry.availableDelta)}>
                      {formatSignedCredit(entry.availableDelta)}
                    </span>
                  </span>
                  <span
                    className={`${styles.deltaLine} ${styles.deltaLineLeft}`}
                  >
                    <span className={styles.deltaLabel}>Đang giữ:</span>
                    <span className={deltaToneClass(entry.heldDelta, true)}>
                      {formatSignedCredit(entry.heldDelta)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onSelectEntry(entry.id)}
                  >
                    Chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
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
    <Link className="btn btn-sm" href={href}>
      Mở {financeLabel(type).toLocaleLowerCase("vi")} liên quan
    </Link>
  ) : null;
}

function LedgerDetail({
  selection,
  onSelect,
  onOpenWallet,
  close,
}: Readonly<{
  selection: Selection;
  onSelect: (next: Selection) => void;
  onOpenWallet?: (userId: string) => void;
  close: () => void;
}>) {
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
            {entry && (
              <EntryPresentation
                entry={entry}
                onSelectOperation={(operationId) =>
                  onSelect({ id: operationId, kind: "operation" })
                }
                onOpenWallet={
                  onOpenWallet
                    ? (userId) => {
                        close();
                        onOpenWallet(userId);
                      }
                    : undefined
                }
              />
            )}
            {operation && (
              <OperationPresentation
                operation={operation}
                onSelectEntry={(entryId) =>
                  onSelect({ id: entryId, kind: "entry" })
                }
              />
            )}
          </>
        )}
      </QueueState>
    </AdminDrawer>
  );
}
