"use client";
import { systemCodeLabel } from "@/lib/system-text";
import Link from "next/link";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import type { Wallet, LedgerEntry } from "./account-types";
const transactionNames: Record<string, string> = {
  TOP_UP: "Nạp Credit",
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
  const wallet = useUserResource<Wallet>("me/wallet"),
    ledger = useUserList<LedgerEntry>("me/wallet/transactions?limit=20");
  return (
    <>
      <PageHeading
        title="Ví Credit"
        action={
          <Link className="btn btn-primary" href="/learn/wallet/topup">
            + Nạp Credit
          </Link>
        }
      />
      <Feedback
        loading={wallet.loading}
        error={wallet.error}
        reload={wallet.reload}
      />
      <div className="wallet-overview">
        <article className="product-balance primary">
          <small>Credit khả dụng</small>
          <strong>
            {wallet.data ? wallet.data.availableCredit : "—"} <small>CR</small>
          </strong>
          <p>Sẵn sàng cho thỏa thuận và tài liệu.</p>
          <Link className="btn" href="/learn/wallet/topup">
            Nạp thêm Credit →
          </Link>
        </article>
        <article className="product-balance">
          <small>Credit đang giữ</small>
          <strong>
            {wallet.data ? wallet.data.heldCredit : "—"} <small>CR</small>
          </strong>
          <p>Theo các thỏa thuận đang được backend giữ Credit.</p>
          <Link className="learner-card-link" href="/learn/paths">
            Xem lộ trình →
          </Link>
        </article>
      </div>
      <Panel>
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Hoạt động của ví</span>
            <h2>Lịch sử giao dịch</h2>
          </div>
          <Link href="/learn/wallet/topup">Lệnh nạp Credit</Link>
        </div>
        <Feedback
          loading={ledger.loading}
          error={ledger.error}
          reload={ledger.reload}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!ledger.loading && !ledger.error && !ledger.items.length && (
          <Empty>Chưa có giao dịch Credit.</Empty>
        )}
        <More
          cursor={ledger.cursor}
          loading={ledger.loading}
          onMore={() => {
            void ledger.more();
          }}
        />
      </Panel>
    </>
  );
}
