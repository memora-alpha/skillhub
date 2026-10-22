"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import {
  creditText,
  type CreditEntry,
  type Wallet,
} from "@/lib/staff/account-types";
import { Pager, QueueState } from "./common";
import { useStaffList, useStaffResource } from "./hooks";

const types: Record<string, string> = {
  TOP_UP: "Nạp Credit",
  DAILY_BONUS: "Thưởng hằng ngày",
  FEEDBACK_BONUS: "Thưởng đánh giá",
  HOLD: "Tạm giữ",
  RELEASE: "Hoàn Credit tạm giữ",
  PATH_RETURN: "Hoàn Credit lộ trình",
  PLATFORM_FEE: "Phí nền tảng",
  TEACHING_PAYMENT: "Thanh toán buổi học",
  TEACHING_EARNING: "Thu nhập giảng dạy",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_SALE: "Bán tài liệu",
  REFUND: "Hoàn tiền",
  PENALTY: "Khấu trừ",
  ADJUSTMENT: "Điều chỉnh",
};

function EntryDetail({
  id,
  close,
}: Readonly<{ id: string; close: () => void }>) {
  const entry = useStaffResource<CreditEntry>(`wallet/transactions/${id}`);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.focus();
  }, []);
  return (
    <section
      id="wallet-transaction-detail"
      ref={section}
      tabIndex={-1}
      className="staff-ledger-details"
      aria-label="Chi tiết giao dịch"
    >
      <Card title="Chi tiết giao dịch">
        <QueueState
          loading={entry.loading}
          error={entry.error}
          empty={!entry.data}
          reload={entry.reload}
        >
          {entry.data && (
            <dl className="kv staff-kv">
              <dt>Mã giao dịch</dt>
              <dd className="mono">{entry.data.id}</dd>
              <dt>Loại</dt>
              <dd>{types[entry.data.type] ?? entry.data.type}</dd>
              <dt>Trạng thái</dt>
              <dd>
                <StatusBadge status={entry.data.status} />
              </dd>
              <dt>Số Credit</dt>
              <dd className="staff-credit">{creditText(entry.data.amount)}</dd>
              <dt>Thay đổi khả dụng</dt>
              <dd className="staff-credit">
                {creditText(entry.data.availableDelta)}
              </dd>
              <dt>Thay đổi tạm giữ</dt>
              <dd className="staff-credit">
                {creditText(entry.data.heldDelta)}
              </dd>
              <dt>Số dư khả dụng sau giao dịch</dt>
              <dd className="staff-credit">
                {creditText(entry.data.availableAfter)}
              </dd>
              <dt>Credit tạm giữ sau giao dịch</dt>
              <dd className="staff-credit">
                {creditText(entry.data.heldAfter)}
              </dd>
              <dt>Tham chiếu</dt>
              <dd className="mono">
                {entry.data.referenceType} · {entry.data.referenceId}
              </dd>
              <dt>Thời gian</dt>
              <dd>{fmtDateTime(entry.data.createdAt)}</dd>
            </dl>
          )}
        </QueueState>
        <button type="button" className="btn" onClick={close}>
          Đóng chi tiết
        </button>
      </Card>
    </section>
  );
}

export function WalletScreen() {
  const wallet = useStaffResource<Wallet>("wallet");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const params = new URLSearchParams({ limit: "20" });
  if (type) params.set("type", type);
  const ledger = useStaffList<CreditEntry>(`wallet/transactions?${params}`);
  return (
    <>
      <PageHeader
        title="Ví của tôi"
        desc="Số dư và lịch sử Credit của tài khoản đang đăng nhập."
        actions={
          <button
            type="button"
            className="btn"
            disabled={wallet.loading || ledger.loading}
            onClick={() => {
              void wallet.reload();
              void ledger.reload();
            }}
          >
            Làm mới
          </button>
        }
      />
      <Card title="Số dư hiện tại">
        <QueueState
          loading={wallet.loading}
          error={wallet.error}
          empty={!wallet.data}
          reload={wallet.reload}
        >
          {wallet.data && (
            <dl className="kv staff-kv">
              <dt>Có thể sử dụng</dt>
              <dd className="staff-credit">
                {creditText(wallet.data.availableCredit)}
              </dd>
              <dt>Đang tạm giữ</dt>
              <dd className="staff-credit">
                {creditText(wallet.data.heldCredit)}
              </dd>
            </dl>
          )}
        </QueueState>
      </Card>
      <div className="toolbar section">
        <label className="staff-field">
          <span>Loại giao dịch</span>
          <select
            className="select"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setSelected(null);
            }}
          >
            <option value="">Tất cả giao dịch</option>
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Card title="Lịch sử Credit" flush>
        {ledger.error ? (
          <QueueState
            loading={false}
            error={ledger.error}
            empty
            reload={ledger.reload}
          >
            {null}
          </QueueState>
        ) : ledger.loading && !ledger.items.length ? (
          <output className="staff-state">Đang tải giao dịch…</output>
        ) : !ledger.items.length ? (
          <Empty
            title="Chưa có giao dịch"
            desc="Giao dịch Credit sẽ xuất hiện ở đây khi được ghi nhận."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Giao dịch</th>
                  <th>Số Credit</th>
                  <th>Khả dụng sau giao dịch</th>
                  <th>Trạng thái</th>
                  <th>
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{fmtDateTime(entry.createdAt)}</td>
                    <td>{types[entry.type] ?? entry.type}</td>
                    <td className="staff-credit">{creditText(entry.amount)}</td>
                    <td className="staff-credit">
                      {creditText(entry.availableAfter)}
                    </td>
                    <td>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`Xem giao dịch ${entry.id}`}
                        aria-expanded={selected === entry.id}
                        aria-controls={
                          selected === entry.id
                            ? "wallet-transaction-detail"
                            : undefined
                        }
                        onClick={(event) => {
                          detailTrigger.current = event.currentTarget;
                          setSelected(entry.id);
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          loading={ledger.loading}
          hasMore={ledger.page?.hasMore}
          more={ledger.more}
        />
      </Card>
      {selected && (
        <EntryDetail
          key={selected}
          id={selected}
          close={() => {
            setSelected(null);
            detailTrigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
