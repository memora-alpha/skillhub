"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useId, useRef, useState } from "react";
import {
  Badge,
  DataTable,
  Card,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { useStaffResource } from "./hooks";
import { QueueState } from "./common";
import { useStaffPagedList } from "./use-staff-paged-list";
import { PageNavigation, type PageNavigationProps } from "./page-navigation";
import { Identifier } from "./operation-tools";
import { MaterialFeePolicies } from "./material-fee-policies";
import { fmtDateTime } from "@/lib/console/format";
import {
  financeLabel,
  financeNumber,
  keyedFinanceItems,
} from "@/lib/staff/finance-presentation";
import { systemCodeLabel } from "@/lib/system-text";
import { UserProfileReference } from "./user-profile-reference";
import styles from "./operations.module.css";
import { AdminLedgerScreen } from "./admin-ledger";
import type { LedgerFilters } from "@/lib/staff/ledger-query";
import {
  emptyPaymentFilters,
  paymentQuery,
  type PaymentFilters,
} from "@/lib/staff/payment-query";
type Payment = {
  id: string;
  userId: string;
  status: string;
  creditAmount: string;
  paymentAmountVnd: string;
  createdAt: string;
  gatewayTransactionId: string | null;
  payosCheckout: { orderCode: string; topUpOperationId: string | null } | null;
};
const labels: Record<string, string> = {
  id: "Mã",
  userId: "Người dùng",
  operationId: "Nghiệp vụ",
  type: "Loại",
  status: "Trạng thái",
  amount: "Credit",
  availableDelta: "Thay đổi khả dụng",
  heldDelta: "Thay đổi đang giữ",
  availableAfter: "Khả dụng sau giao dịch",
  heldAfter: "Đang giữ sau giao dịch",
  createdAt: "Ngày tạo",
  operationType: "Loại nghiệp vụ",
  referenceType: "Nguồn",
  referenceId: "Mã tham chiếu",
  entries: "Bút toán",
  availableCredit: "Credit khả dụng",
  heldCredit: "Credit đang giữ",
  walletVersion: "Phiên bản ví",
  records: "Kết quả",
  findings: "Phát hiện",
  paymentId: "Thanh toán",
  paymentAmountVnd: "Số tiền VND",
  creditAmount: "Credit",
  orderCode: "Mã đơn",
  currentChannelMatches: "Khớp kênh hiện tại",
  topUpOperationIds: "Nghiệp vụ nạp",
  provider: "Nhà cung cấp",
  gatewayTransactionId: "Mã giao dịch cổng",
  currency: "Tiền tệ",
  gateway: "Cổng",
  externalOrderRef: "Mã đơn ngoài",
  payosCheckout: "Đơn thanh toán",
  state: "Tình trạng",
  paidAt: "Thanh toán lúc",
  expiresAt: "Hết hạn",
  conversionRateVndPerCredit: "VND/Credit",
  topUpOperationId: "Nghiệp vụ nạp",
  operationIdRecord: "Nguồn nghiệp vụ",
  reversesTransactionId: "Đảo giao dịch",
  checked: "Đã kiểm tra",
  summary: "Tổng hợp",
  consistent: "Khớp",
  count: "Số lượng",
};
function FinanceDetails({ value }: Readonly<{ value: unknown }>) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "boolean") return <span>{value ? "Có" : "Không"}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul>
        {keyedFinanceItems(value).map(({ value: item, key }) => (
          <li key={key}>
            <FinanceDetails value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span>Không có</span>
    );
  if (typeof value === "object")
    return (
      <dl className={styles.detail}>
        {Object.entries(value).map(([key, v]) => (
          <div key={key}>
            <dt>{labels[key] || "Thông tin bổ sung"}</dt>
            <dd style={{ overflowWrap: "anywhere" }}>
              {typeof v === "string" ? (
                <FinanceValue
                  name={key}
                  value={v}
                  payment={"paymentAmountVnd" in value}
                />
              ) : (
                <FinanceDetails value={v} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  if (typeof value === "string")
    return (
      <span>
        {/^[A-Z][A-Z0-9_]+$/.test(value)
          ? systemCodeLabel(value, "Thông tin bổ sung")
          : value}
      </span>
    );
  if (typeof value === "number" || typeof value === "bigint")
    return <span>{value.toString()}</span>;
  return <span>—</span>;
}
export function FinanceScreen({
  initialTab = "ledger",
  initialPaymentId,
  initialLedgerFilters,
  initialWalletId,
  initialPaymentFilters,
  initialPaymentStatus,
}: Readonly<{
  initialTab?: string;
  initialPaymentId?: string;
  initialLedgerFilters?: LedgerFilters;
  initialWalletId?: string;
  initialPaymentFilters?: PaymentFilters;
  initialPaymentStatus?: string;
}>) {
  const [tab, setTab] = useState(
    ["ledger", "payments", "wallet", "fees"].includes(initialTab)
      ? initialTab
      : "ledger",
  );
  function switchTab(next: string) {
    setTab(next);
    window.history.replaceState(null, "", `/admin/credits?tab=${next}`);
  }
  function financeTab() {
    if (tab === "ledger") {
      return <AdminLedgerScreen initialFilters={initialLedgerFilters} />;
    }
    if (tab === "payments") {
      return (
        <PaymentsScreen
          initialPaymentId={initialPaymentId}
          initialFilters={initialPaymentFilters}
          initialStatus={initialPaymentStatus}
        />
      );
    }
    if (tab === "wallet") {
      return <WalletLookup initialUserId={initialWalletId} />;
    }
    return <MaterialFeePolicies />;
  }
  return (
    <>
      <PageHeader
        title="Tài chính & Credit"
        desc="Tra cứu sổ cái Credit bất biến, đối soát nạp tiền payOS, ví người dùng và chính sách phí nền tảng."
      />
      <div className="ops-policy-banner" role="note">
        <span>
          <strong>Quy chuẩn Credit (SRS V1.7):</strong> 1.000 VND = 1 Credit ·
          Không hỗ trợ rút Credit ra tiền mặt (BR-26).
        </span>
        <div className="ops-policy-pills">
          <Badge tone="brand">
            TWO_WAY: cam kết ≥20 CR · hoàn 96% / phí 4%
          </Badge>
          <Badge tone="info">ONE_WAY: trả teacher 96% / phí 4%</Badge>
        </div>
      </div>
      <div className="ops-tabbar">
        <Segmented
          label="Mục tài chính"
          value={tab}
          onChange={switchTab}
          options={[
            { id: "ledger", label: "Giao dịch Credit" },
            { id: "payments", label: "Thanh toán nạp" },
            { id: "wallet", label: "Ví người dùng" },
            { id: "fees", label: "Phí & doanh thu" },
          ]}
        />
      </div>
      {financeTab()}
    </>
  );
}
function PaymentsScreen({
  initialPaymentId,
  initialFilters = emptyPaymentFilters,
  initialStatus = "",
}: Readonly<{
  initialPaymentId?: string;
  initialFilters?: PaymentFilters;
  initialStatus?: string;
}>) {
  const [status, setStatus] = useState(
    Object.hasOwn(paymentStatuses, initialStatus) ? initialStatus : "",
  );
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(() => {
    try {
      paymentQuery(initialFilters);
      return initialFilters;
    } catch {
      return emptyPaymentFilters;
    }
  });
  const [filterError, setFilterError] = useState(() => {
    try {
      paymentQuery(initialFilters);
      return "";
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.";
    }
  });
  const [selected, setSelected] = useState<string | undefined>(() =>
    initialPaymentId &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(initialPaymentId)
      ? `payments/${initialPaymentId}`
      : undefined,
  );
  const params = paymentQuery(filters);
  if (status) params.set("status", status);
  const list = useStaffPagedList<Payment>("payments?" + params);
  return (
    <Card
      title="Thanh toán nạp Credit"
      actions={
        <div className={styles.actions}>
          <LoadingButton
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => void list.reload()}
            loading={!!list.loading}
          >
            Làm mới
          </LoadingButton>
        </div>
      }
    >
      <p className={styles.hint}>
        Tra cứu đơn nạp và đối chiếu với dữ liệu thanh toán đã ghi nhận.
      </p>
      <div className={styles.filters}>
        <label>
          <span>Trạng thái</span>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSelected(undefined);
              const query = paymentQuery(filters);
              query.delete("limit");
              query.delete("includeTotal");
              query.set("tab", "payments");
              if (e.target.value) query.set("status", e.target.value);
              window.history.replaceState(null, "", "/admin/credits?" + query);
            }}
          >
            <option value="">Tất cả</option>
            {[
              "CREATED",
              "PENDING",
              "PAID",
              "REVIEW",
              "CANCELLED",
              "EXPIRED",
              "FAILED",
              "REFUNDED",
            ].map((s) => (
              <option key={s} value={s}>
                {paymentStatuses[s] || s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const next = Object.fromEntries(
              Object.entries(draftFilters).map(([key, value]) => [
                key,
                value.trim(),
              ]),
            ) as PaymentFilters;
            const query = paymentQuery(next);
            setFilters(next);
            setFilterError("");
            setSelected(undefined);
            query.delete("limit");
            query.delete("includeTotal");
            query.set("tab", "payments");
            if (status) query.set("status", status);
            window.history.replaceState(null, "", "/admin/credits?" + query);
          } catch (cause) {
            setFilterError(
              cause instanceof Error ? cause.message : "Bộ lọc chưa hợp lệ.",
            );
          }
        }}
      >
        <details className="admin-advanced-filter">
          <summary className="btn">Tra cứu thanh toán nâng cao</summary>
          <div className="row">
            {(
              [
                ["userId", "Mã người dùng", "text"],
                ["orderCode", "Mã đơn payOS", "text"],
                [
                  "gatewayTransactionId",
                  "Mã giao dịch cổng thanh toán",
                  "text",
                ],
                ["from", "Tạo từ (UTC)", "datetime-local"],
                ["before", "Tạo trước (UTC)", "datetime-local"],
                ["paidFrom", "Thanh toán từ (UTC)", "datetime-local"],
                ["paidBefore", "Thanh toán trước (UTC)", "datetime-local"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key}>
                {label}
                <input
                  className="input"
                  type={type}
                  value={draftFilters[key]}
                  maxLength={key === "userId" ? 36 : 255}
                  onChange={(event) =>
                    setDraftFilters((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </details>
        <button type="submit" className="btn">
          Áp dụng tra cứu
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDraftFilters(emptyPaymentFilters);
            setFilters(emptyPaymentFilters);
            setFilterError("");
            setStatus("");
            setSelected(undefined);
            window.history.replaceState(
              null,
              "",
              "/admin/credits?tab=payments",
            );
          }}
        >
          Bỏ lọc
        </button>
      </form>
      {filterError && (
        <p className="staff-error" role="alert">
          {filterError}
        </p>
      )}
      {list.page?.total !== undefined && (
        <p className={styles.hint}>{list.page.total} thanh toán phù hợp</p>
      )}
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyTitle="Chưa có thanh toán"
        emptyDescription="Không có thanh toán phù hợp với trạng thái đã chọn."
        reload={list.reload}
      >
        <DataTable
          columns={[
            "Đơn / ngày",
            "Người dùng",
            "Số tiền",
            "Trạng thái",
            "Tra cứu",
          ]}
          className={`table ${styles.table}`}
        >
          {list.items.map((p) => (
            <tr key={p.id}>
              <td data-label="Đơn / ngày">
                <strong>
                  {p.payosCheckout?.orderCode
                    ? `Đơn #${p.payosCheckout.orderCode}`
                    : `Thanh toán #${p.id.slice(0, 8)}`}
                </strong>
                <small>{fmtDateTime(p.createdAt)}</small>
              </td>
              <td data-label="Người dùng">
                <UserProfileReference userId={p.userId} />
              </td>
              <td data-label="Số tiền">
                <span className={styles.money}>
                  {financeNumber(p.paymentAmountVnd)} ₫
                </span>
                <small>{financeNumber(p.creditAmount)} CR</small>
              </td>
              <td data-label="Trạng thái">
                <PaymentStatus status={p.status} />
              </td>
              <td data-label="Thao tác">
                <FinanceActions
                  actions={[
                    { path: `payments/${p.id}`, label: "Chi tiết" },
                    {
                      path: `payments/${p.id}/reconciliation`,
                      label: "Đối soát",
                    },
                  ]}
                  onSelect={setSelected}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </QueueState>
      <FinanceQueueFooter
        loading={list.loading}
        pageNumber={list.pageNumber}
        totalPages={list.totalPages}
        hasNext={list.page?.hasMore ?? false}
        onPageChange={(page) => {
          setSelected(undefined);
          void list.goToPage(page);
        }}
        selected={selected}
        onClose={() => setSelected(undefined)}
      />
    </Card>
  );
}
function WalletLookup({
  initialUserId = "",
}: Readonly<{ initialUserId?: string }>) {
  const initial = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
    initialUserId,
  )
    ? initialUserId
    : "";
  const [draft, setDraft] = useState(initial);
  const [id, setId] = useState(initial);
  return (
    <Card title="Tra cứu ví người dùng">
      <p className={styles.hint}>
        Nhập mã người dùng để xem Credit khả dụng và Credit đang giữ.
      </p>
      <div className={styles.filters}>
        <Identifier value={draft} onChange={setDraft} onSearch={setId} />
      </div>
      {id && (
        <Detail key={id} path={`users/${id}/wallet`} close={() => setId("")} />
      )}
      {!id && (
        <div className={styles.lookupEmpty}>
          <strong>Chọn ví cần tra cứu</strong>Mã người dùng có trong danh sách
          người dùng hoặc chi tiết giao dịch.
        </div>
      )}
    </Card>
  );
}
function Detail({
  path,
  close,
}: Readonly<{ path: string; close: () => void }>) {
  const resource = useStaffResource<unknown>(path);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    heading.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  function detailTitle() {
    if (path.endsWith("/reconciliation")) {
      return "Đối soát thanh toán";
    }
    if (path.endsWith("/wallet")) {
      return "Ví người dùng";
    }
    if (path.startsWith("payments/")) {
      return "Chi tiết thanh toán";
    }
    if (path.startsWith("credit/operations/")) {
      return "Chi tiết nghiệp vụ";
    }
    return "Chi tiết giao dịch";
  }
  const title = detailTitle();
  return (
    <dialog
      ref={dialog}
      className={styles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className={styles.drawerHead}>
        <h2 id={titleId} tabIndex={-1} ref={heading}>
          {title}
        </h2>
        <button type="button" className="btn" onClick={close}>
          Đóng
        </button>
      </div>
      <div className={styles.drawerBody}>
        <QueueState
          loading={resource.loading}
          error={resource.error}
          empty={!resource.data}
          reload={resource.reload}
        >
          <PrimaryFinance value={resource.data} />
          <details className={styles.technical}>
            <summary>Thông tin đối chiếu & mã tham chiếu</summary>
            <FinanceDetails value={resource.data} />
          </details>
        </QueueState>
      </div>
    </dialog>
  );
}

function FinanceValue({
  name,
  value,
  payment = false,
}: Readonly<{ name: string; value: string; payment?: boolean }>) {
  if (name === "userId") return <UserProfileReference userId={value} />;
  if (name === "status")
    return payment ? (
      <PaymentStatus status={value} />
    ) : (
      <StatusBadge status={value} />
    );
  if (["createdAt", "paidAt", "expiresAt"].includes(name))
    return (
      <>
        {Number.isFinite(Date.parse(value))
          ? fmtDateTime(value)
          : "Chưa có thời gian"}
      </>
    );
  if (["type", "operationType", "referenceType"].includes(name))
    return <>{financeLabel(value)}</>;
  if (
    [
      "amount",
      "creditAmount",
      "availableCredit",
      "heldCredit",
      "availableDelta",
      "heldDelta",
      "availableAfter",
      "heldAfter",
    ].includes(name)
  )
    return <span className={styles.money}>{financeNumber(value)} CR</span>;
  if (name === "paymentAmountVnd")
    return <span className={styles.money}>{financeNumber(value)} ₫</span>;
  return (
    <>
      {["state", "providerStatus", "basis"].includes(name)
        ? systemCodeLabel(value, "Thông tin bổ sung")
        : value}
    </>
  );
}
function PrimaryFinance({ value }: Readonly<{ value: unknown }>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const fields = [
    "status",
    "amount",
    "paymentAmountVnd",
    "creditAmount",
    "availableCredit",
    "heldCredit",
    "availableDelta",
    "heldDelta",
    "availableAfter",
    "heldAfter",
    "operationType",
    "referenceType",
    "createdAt",
  ];
  return (
    <>
      <dl className={styles.detail}>
        {fields
          .filter((k) => row[k] !== undefined && row[k] !== null)
          .map((k) => (
            <div key={k}>
              <dt>{labels[k] || k}</dt>
              <dd>
                <FinanceValue
                  name={k}
                  value={String(row[k])}
                  payment={"paymentAmountVnd" in row}
                />
              </dd>
            </div>
          ))}
      </dl>
      {Array.isArray(row.records) &&
        keyedFinanceItems(row.records).map(({ value: record, key }) => {
          const r = record as Record<string, unknown>;
          return (
            <section key={key}>
              <h4>Kết quả đối soát</h4>
              {Array.isArray(r.findings) && r.findings.length ? (
                <ul>
                  {keyedFinanceItems(r.findings).map(({ value: f, key }) => (
                    <li key={key}>
                      {typeof f === "string"
                        ? systemCodeLabel(f, "Có sai lệch cần kiểm tra thêm.")
                        : "Có sai lệch cần kiểm tra thêm."}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Không ghi nhận sai lệch.</p>
              )}
            </section>
          );
        })}
    </>
  );
}

const paymentStatuses: Record<string, string> = {
  CREATED: "Mới tạo",
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  REVIEW: "Cần xem xét",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn",
};
function PaymentStatus({ status }: Readonly<{ status: string }>) {
  function paymentTone() {
    if (status === "PAID") {
      return "ok";
    }
    if (status === "FAILED") {
      return "bad";
    }
    if (["PENDING", "REVIEW"].includes(status)) {
      return "warn";
    }
    return "neutral";
  }
  const tone = paymentTone();
  return (
    <span className={`badge badge-${tone}`}>
      {paymentStatuses[status] ?? "Chưa xác định"}
    </span>
  );
}

function FinanceActions({
  actions,
  onSelect,
}: Readonly<{
  actions: readonly { path: string; label: string }[];
  onSelect: (path: string) => void;
}>) {
  return (
    <div className={styles.actions}>
      {actions.map((action) => (
        <button
          key={action.path}
          type="button"
          className="btn"
          onClick={() => onSelect(action.path)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
function FinanceQueueFooter({
  selected,
  onClose,
  ...pagination
}: Readonly<
  {
    selected?: string;
    onClose: () => void;
  } & PageNavigationProps
>) {
  return (
    <>
      <PageNavigation {...pagination} />
      {selected && <Detail key={selected} path={selected} close={onClose} />}
    </>
  );
}
