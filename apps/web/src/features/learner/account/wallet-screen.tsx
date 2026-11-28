"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { systemCodeLabel } from "@/lib/system-text";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { financeNumber } from "@/lib/staff/finance-presentation";
import { useUserResource } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import type { Wallet, LedgerEntry } from "./account-types";
const transactionNames: Record<string, string> = {
  TOP_UP: "Nạp Credit",
  VOUCHER_REDEMPTION: "Đổi voucher",
  SUBSCRIPTION_CHARGE: "Gói thành viên",
  DAILY_BONUS: "Thưởng hằng ngày",
  FEEDBACK_BONUS: "Thưởng phản hồi",
  HOLD: "Tạm giữ Credit",
  RELEASE: "Giải phóng Credit",
  PATH_RETURN: "Hoàn Credit lộ trình",
  PLATFORM_FEE: "Phí nền tảng",
  TEACHING_PAYMENT: "Thanh toán giảng dạy",
  TEACHING_EARNING: "Thu nhập giảng dạy",
  MATERIAL_PURCHASE: "Mua tài liệu",
  MATERIAL_SALE: "Bán tài liệu",
  REFUND: "Ghi nhận hoàn Credit",
  PENALTY: "Khấu trừ",
  ADJUSTMENT: "Điều chỉnh",
};
export function WalletScreen() {
  const [type, setType] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [selected, setSelected] = useState<string>();
  const params = new URLSearchParams({ limit: "20" });
  if (type) params.set("type", type);
  if (referenceType) params.set("referenceType", referenceType);
  const wallet = useUserResource<Wallet>("me/wallet"),
    ledger = useUserPagedList<LedgerEntry>("me/wallet/transactions?" + params);
  return (
    <>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link href="/learn/vouchers" className="btn">
          Đổi voucher bằng Credit →
        </Link>
        <Link href="/learn/subscription" className="btn">
          Quản lý gói thành viên →
        </Link>
      </p>
      <PageHeading
        eyebrow="Tài chính trên SkillHub"
        title="Ví Credit"
        description="Quản lý số dư khả dụng, khoản tạm giữ theo thỏa thuận và lịch sử sổ cái bất biến."
        action={
          <Link className="btn btn-primary" href="/learn/wallet/topup">
            + Nạp Credit
          </Link>
        }
      />
      <Feedback
        loading={wallet.initialLoading}
        error={wallet.error}
        reload={wallet.reload}
        refreshing={!!(wallet.loading && !wallet.initialLoading)}
      />
      <div className="wallet-overview">
        <article className="product-balance primary">
          <small>Credit khả dụng</small>
          <strong>
            {wallet.data ? wallet.data.availableCredit : "—"} <small>CR</small>
          </strong>
          <p>
            Dùng để cam kết trao đổi 2 chiều, thanh toán học 1 chiều và mua tài
            liệu số.
          </p>
          <Link className="btn" href="/learn/wallet/topup">
            Nạp thêm Credit →
          </Link>
        </article>
        <article className="product-balance">
          <small>Credit đang tạm giữ (Held)</small>
          <strong>
            {wallet.data ? wallet.data.heldCredit : "—"} <small>CR</small>
          </strong>
          <p>
            Được khóa khi chốt lịch và quyết toán một lần duy nhất sau khi toàn
            bộ lộ trình hoàn tất.
          </p>
          <Link className="learner-card-link" href="/learn/paths">
            Theo dõi lộ trình đang học →
          </Link>
        </article>
      </div>
      <div
        className="credit-policy-strip"
        role="note"
        aria-label="Quy tắc Credit"
      >
        <span>
          <strong>1.000 VNĐ = 1 Credit</strong>
        </span>
        <span>
          <strong>Phí quyết toán:</strong> Theo chính sách được máy chủ chốt cho
          từng thỏa thuận. Xem phân bổ Credit trước khi xác nhận.
        </span>
        <span>
          <strong>Không rút tiền mặt:</strong> Credit chỉ dùng trong hệ thống
          SkillHub
        </span>
      </div>
      <Panel>
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Sổ cái giao dịch</span>
            <h2>Lịch sử biến động Credit</h2>
          </div>
          <Link href="/learn/wallet/topup">Lệnh nạp Credit →</Link>
        </div>
        <div className="wallet-filters">
          <label>
            <span>Loại giao dịch</span>
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setSelected(undefined);
              }}
            >
              <option value="">Tất cả giao dịch</option>
              {Object.entries(transactionNames).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Nguồn giao dịch</span>
            <select
              value={referenceType}
              onChange={(event) => {
                setReferenceType(event.target.value);
                setSelected(undefined);
              }}
            >
              <option value="">Tất cả nguồn</option>
              {Object.entries(referenceLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Feedback
          loading={ledger.initialLoading}
          error={ledger.error}
          reload={ledger.reload}
          refreshing={!!(ledger.loading && !ledger.initialLoading)}
        />
        {!!ledger.items.length && (
          <div className="product-table-scroll">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Giao dịch</th>
                  <th>Thời gian</th>
                  <th>Thay đổi khả dụng</th>
                  <th>Thay đổi đang giữ</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {transactionNames[row.type] ??
                        systemCodeLabel(row.type, "Giao dịch khác")}
                    </td>
                    <td>{formatTime(row.createdAt)}</td>
                    <td
                      className={
                        row.availableDelta.startsWith("-")
                          ? "negative"
                          : "positive"
                      }
                    >
                      {row.availableDelta} CR
                    </td>
                    <td>{row.heldDelta} CR</td>
                    <td>
                      <Status value={row.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setSelected(row.id)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!ledger.loading && !ledger.error && !ledger.items.length && (
          <Empty>Chưa có giao dịch Credit.</Empty>
        )}
        <ListPagination query={ledger} />
      </Panel>
      {selected && (
        <WalletTransactionDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}
const referenceLabels: Record<string, string> = {
  PAYMENT: "Nạp Credit",
  LEARNING_PATH: "Lộ trình",
  SESSION: "Buổi học",
  REVIEW: "Đánh giá",
  DISPUTE: "Vụ việc",
  MATERIAL_ORDER: "Đơn tài liệu",
  VOUCHER_REDEMPTION: "Đổi voucher",
  SUBSCRIPTION_CHARGE: "Gói thành viên",
  SYSTEM: "Hệ thống",
};
function WalletTransactionDetail({
  id,
  onClose,
}: Readonly<{ id: string; onClose: () => void }>) {
  const query = useUserResource<LedgerEntry>(`me/wallet/transactions/${id}`);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "start" });
    panel.current?.focus();
  }, []);
  const row = query.data;
  const destinations: Record<string, string> = {
    PAYMENT: "/learn/wallet/topup?paymentId=",
    LEARNING_PATH: "/learn/paths/",
    SESSION: "/learn/sessions/",
    VOUCHER_REDEMPTION: "/learn/vouchers/mine/",
  };
  const target =
    row &&
    destinations[row.referenceType] &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(row.referenceId)
      ? destinations[row.referenceType] + row.referenceId
      : undefined;
  return (
    <div ref={panel} tabIndex={-1}>
      <Panel title="Chi tiết giao dịch">
        <button type="button" className="btn" onClick={onClose}>
          Đóng chi tiết
        </button>
        <Feedback
          loading={query.initialLoading}
          error={query.error}
          reload={query.reload}
          refreshing={!!(query.loading && !query.initialLoading)}
        />
        {row && (
          <div className="learner-stack">
            <h3>{transactionNames[row.type] ?? "Giao dịch Credit"}</h3>
            <p>
              {formatTime(row.createdAt)} · <Status value={row.status} />
            </p>
            <p>
              Khả dụng thay đổi:{" "}
              <strong>{financeNumber(row.availableDelta)} CR</strong>
            </p>
            <p>
              Đang giữ thay đổi:{" "}
              <strong>{financeNumber(row.heldDelta)} CR</strong>
            </p>
            <p>
              Số dư khả dụng sau giao dịch: {financeNumber(row.availableAfter)}{" "}
              CR
            </p>
            <p>
              Số dư đang giữ sau giao dịch: {financeNumber(row.heldAfter)} CR
            </p>
            <p>
              Nguồn:{" "}
              {referenceLabels[row.referenceType] ?? "Giao dịch liên quan"}
            </p>
            {target && <Link href={target}>Xem thông tin liên quan →</Link>}
            <details>
              <summary>Mã giao dịch</summary>
              <code>{row.id}</code>
            </details>
          </div>
        )}
      </Panel>
    </div>
  );
}
