"use client";
import { useState } from "react";
import { Card, PageHeader, StatusBadge } from "@/components/console/ui";
import { useStaffList, useStaffResource } from "./hooks";
import { Pager, QueueState } from "./common";
import { Identifier } from "./operation-tools";
import { MaterialFeePolicies } from "./material-fee-policies";
import { fmtDateTime } from "@/lib/console/format";
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
        {value.map((item, i) => (
          <li key={i}>
            <FinanceDetails value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span>Không có</span>
    );
  if (typeof value === "object")
    return (
      <dl className="kv staff-kv">
        {Object.entries(value).map(([key, v]) => (
          <div key={key}>
            <dt>{labels[key] || key}</dt>
            <dd style={{ overflowWrap: "anywhere" }}>
              <FinanceDetails value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value)}</span>;
}
export function FinanceScreen() {
  const [tab, setTab] = useState("ledger");
  return (
    <>
      <PageHeader
        title="Tài chính"
        desc="Tra cứu Credit, thanh toán và phí nền tảng."
      />
      <div className="toolbar" role="group" aria-label="Mục tài chính">
        {[
          ["ledger", "Giao dịch"],
          ["payments", "Thanh toán"],
          ["wallet", "Ví người dùng"],
          ["fees", "Phí & doanh thu"],
        ].map(([id, label]) => (
          <button
            className={`btn ${tab === id ? "btn-primary" : ""}`}
            key={id}
            onClick={() => setTab(id!)}
            aria-pressed={tab === id}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "ledger" ? (
        <LedgerScreen />
      ) : tab === "payments" ? (
        <PaymentsScreen />
      ) : tab === "wallet" ? (
        <WalletLookup />
      ) : (
        <MaterialFeePolicies />
      )}
    </>
  );
}
function LedgerScreen() {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const list = useStaffList<Ledger>(
    `credit/transactions?limit=20${filter ? `&userId=${filter}` : ""}`,
  );
  return (
    <Card>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(draft);
          setSelected(undefined);
        }}
      >
        <Identifier value={draft} onChange={setDraft} />
        <button className="btn">Lọc người dùng</button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setDraft("");
            setFilter("");
            setSelected(undefined);
          }}
        >
          Tất cả
        </button>
      </form>
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        reload={list.reload}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ngày / người dùng</th>
                <th>Loại</th>
                <th>Credit</th>
                <th>Khả dụng / giữ</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    {fmtDateTime(r.createdAt)}
                    <details>
                      <summary>Người dùng</summary>
                      {r.userId}
                    </details>
                  </td>
                  <td>{transactionLabels[r.type] || r.type}</td>
                  <td>{r.amount}</td>
                  <td>
                    {r.availableAfter} / {r.heldAfter}
                  </td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => setSelected(`credit/transactions/${r.id}`)}
                    >
                      Giao dịch
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        setSelected(`credit/operations/${r.operationId}`)
                      }
                    >
                      Nghiệp vụ
                    </button>
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
    `payments?limit=20${status ? `&status=${status}` : ""}`,
  );
  return (
    <Card>
      <label>
        Trạng thái
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
      <QueueState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        reload={list.reload}
      >
        <div className="table-wrap">
          <table>
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
                  <td>
                    {p.payosCheckout?.orderCode || p.id}
                    <small>{fmtDateTime(p.createdAt)}</small>
                  </td>
                  <td>
                    <details>
                      <summary>Xem mã người dùng</summary>
                      {p.userId}
                    </details>
                  </td>
                  <td>
                    {p.paymentAmountVnd} VND / {p.creditAmount} CR
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => setSelected(`payments/${p.id}`)}
                    >
                      Chi tiết
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        setSelected(`payments/${p.id}/reconciliation`)
                      }
                    >
                      Đối soát
                    </button>
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
    <Card>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setId(draft);
        }}
      >
        <Identifier value={draft} onChange={setDraft} />
        <button className="btn">Xem ví</button>
      </form>
      {id && (
        <Detail key={id} path={`users/${id}/wallet`} close={() => setId("")} />
      )}
    </Card>
  );
}
function Detail({
  path,
  close,
}: Readonly<{ path: string; close: () => void }>) {
  const resource = useStaffResource<unknown>(path);
  return (
    <section>
      <div className="row">
        <h3>Kết quả tra cứu</h3>
        <button className="btn" onClick={close}>
          Đóng
        </button>
      </div>
      <QueueState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.data}
        reload={resource.reload}
      >
        <PrimaryFinance value={resource.data} />
        <details>
          <summary>Chi tiết kỹ thuật</summary>
          <FinanceDetails value={resource.data} />
        </details>
      </QueueState>
    </section>
  );
}

const transactionLabels: Record<string, string> = {
  TOP_UP: "Nạp Credit",
  HOLD: "Giữ Credit",
  RELEASE: "Hoàn Credit giữ",
  SETTLEMENT: "Quyết toán",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_SALE: "Bán tài liệu",
  MATERIAL_REFUND: "Hoàn tài liệu",
  ADJUSTMENT: "Điều chỉnh",
  PLATFORM_FEE: "Phí nền tảng",
  REVERSAL: "Bút toán đảo",
};
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
      <dl className="kv staff-kv">
        {fields
          .filter((k) => row[k] !== undefined && row[k] !== null)
          .map((k) => (
            <div key={k}>
              <dt>{labels[k] || k}</dt>
              <dd>
                {k === "status" ? (
                  <StatusBadge status={String(row[k])} />
                ) : k === "createdAt" ? (
                  fmtDateTime(String(row[k]))
                ) : (
                  String(row[k])
                )}
              </dd>
            </div>
          ))}
      </dl>
      {Array.isArray(row.records) &&
        row.records.map((record, index) => {
          const r = record as Record<string, unknown>;
          return (
            <section key={index}>
              <h4>Kết quả đối soát</h4>
              {Array.isArray(r.findings) && r.findings.length ? (
                <ul>
                  {r.findings.map((f, i) => (
                    <li key={i}>
                      {typeof f === "string" ? f : JSON.stringify(f)}
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
