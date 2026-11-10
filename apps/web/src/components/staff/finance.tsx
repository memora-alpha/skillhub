"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Card,
  PageHeader,
  Segmented,
  StatusBadge,
} from "@/components/console/ui";
import { useStaffList, useStaffResource } from "./hooks";
import { Pager, QueueState } from "./common";
import { Identifier } from "./operation-tools";
import { MaterialFeePolicies } from "./material-fee-policies";
import { fmtDateTime } from "@/lib/console/format";
import {
  financeLabel,
  financeNumber,
  keyedFinanceItems,
} from "@/lib/staff/finance-presentation";
import { systemCodeLabel } from "@/lib/system-text";
import { OperationReference } from "./operation-reference";
import styles from "./operations.module.css";
type Ledger = {
  id: string;
  userId: string;
  operationId: string;
  type: string;
  status: string;
  amount: string;
  availableDelta: string;
  heldDelta: string;
  availableAfter: string;
  heldAfter: string;
  createdAt: string;
};
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
export function FinanceScreen() {
  const [tab, setTab] = useState("ledger");
  function financeTab() {
    if (tab === "ledger") {
      return <LedgerScreen />;
    }
    if (tab === "payments") {
      return <PaymentsScreen />;
    }
    if (tab === "wallet") {
      return <WalletLookup />;
    }
    return <MaterialFeePolicies />;
  }
  return (
    <>
      <PageHeader
        title="Tài chính"
        desc="Tra cứu Credit, thanh toán và phí nền tảng."
      />
      <div className={styles.tabs}>
        <Segmented
          label="Mục tài chính"
          value={tab}
          onChange={setTab}
          options={[
            { id: "ledger", label: "Giao dịch Credit" },
            { id: "payments", label: "Thanh toán" },
            { id: "wallet", label: "Ví người dùng" },
            { id: "fees", label: "Phí & doanh thu" },
          ]}
        />
      </div>
      {financeTab()}
    </>
  );
}
function LedgerScreen() {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const list = useStaffList<Ledger>(
    "credit/transactions?" +
      new URLSearchParams({
        limit: "20",
        ...(filter ? { userId: filter } : {}),
      }),
  );
  return (
    <Card
      title="Lịch sử giao dịch Credit"
      actions={
        <div className={styles.actions}>
          <span className="muted">
            {list.items.length}
            {list.page?.hasMore ? "+" : ""} giao dịch đã tải
          </span>
          <button
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => void list.reload()}
          >
            Làm mới
          </button>
        </div>
      }
    >
      <p className={styles.hint}>
        Xem biến động Credit và số dư sau từng giao dịch.
      </p>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(draft.trim());
          setSelected(undefined);
        }}
      >
        <Identifier value={draft} onChange={setDraft} />
        <button type="submit" className="btn btn-primary">
          Lọc người dùng
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setDraft("");
            setFilter("");
            setSelected(undefined);
          }}
        >
          Bỏ lọc
        </button>
      </form>
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyTitle="Chưa có giao dịch"
        emptyDescription="Thử bỏ bộ lọc hoặc kiểm tra lại mã người dùng."
        reload={list.reload}
      >
        <div className="table-wrap">
          <table className={`table ${styles.table}`}>
            <thead>
              <tr>
                <th>Ngày / người dùng</th>
                <th>Loại</th>
                <th>Credit</th>
                <th>Số dư sau giao dịch</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((r) => (
                <tr key={r.id}>
                  <td data-label="Ngày / người dùng">
                    {fmtDateTime(r.createdAt)}
                    <OperationReference id={r.userId} label="Người dùng" />
                  </td>
                  <td data-label="Loại">
                    {financeLabel(r.type)}
                    <small>
                      <StatusBadge status={r.status} />
                    </small>
                  </td>
                  <td data-label="Credit">
                    <span className={styles.money}>
                      {financeNumber(r.amount)} CR
                    </span>
                  </td>
                  <td data-label="Số dư sau giao dịch">
                    <span className={styles.money}>
                      {financeNumber(r.availableAfter)} CR
                    </span>
                    <small>Đang giữ: {financeNumber(r.heldAfter)} CR</small>
                  </td>
                  <td data-label="Thao tác">
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setSelected(`credit/transactions/${r.id}`)
                        }
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setSelected(`credit/operations/${r.operationId}`)
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
      </QueueState>
      <Pager
        loading={list.loading}
        more={list.more}
        hasMore={list.page?.hasMore}
      />
      {selected && (
        <Detail
          key={selected}
          path={selected}
          close={() => setSelected(undefined)}
        />
      )}
    </Card>
  );
}
function PaymentsScreen() {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string>();
  const list = useStaffList<Payment>(
    "payments?" +
      new URLSearchParams({ limit: "20", ...(status ? { status } : {}) }),
  );
  return (
    <Card
      title="Thanh toán nạp Credit"
      actions={
        <div className={styles.actions}>
          <span className="muted">
            {list.items.length}
            {list.page?.hasMore ? "+" : ""} thanh toán đã tải
          </span>
          <button
            type="button"
            className="btn"
            disabled={list.loading}
            onClick={() => void list.reload()}
          >
            Làm mới
          </button>
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
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyTitle="Chưa có thanh toán"
        emptyDescription="Không có thanh toán phù hợp với trạng thái đã chọn."
        reload={list.reload}
      >
        <div className="table-wrap">
          <table className={`table ${styles.table}`}>
            <thead>
              <tr>
                <th>Đơn / ngày</th>
                <th>Người dùng</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Tra cứu</th>
              </tr>
            </thead>
            <tbody>
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
                    <OperationReference id={p.userId} label="Người dùng" />
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
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setSelected(`payments/${p.id}`)}
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setSelected(`payments/${p.id}/reconciliation`)
                        }
                      >
                        Đối soát
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueueState>
      <Pager
        loading={list.loading}
        more={list.more}
        hasMore={list.page?.hasMore}
      />
      {selected && (
        <Detail
          key={selected}
          path={selected}
          close={() => setSelected(undefined)}
        />
      )}
    </Card>
  );
}
function WalletLookup() {
  const [draft, setDraft] = useState("");
  const [id, setId] = useState("");
  return (
    <Card title="Tra cứu ví người dùng">
      <p className={styles.hint}>
        Nhập mã người dùng để xem Credit khả dụng và Credit đang giữ.
      </p>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          setId(draft);
        }}
      >
        <Identifier value={draft} onChange={setDraft} />
        <button type="submit" className="btn btn-primary">
          Xem ví
        </button>
      </form>
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
