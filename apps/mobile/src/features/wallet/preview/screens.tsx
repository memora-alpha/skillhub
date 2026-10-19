import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Panel, Copy, Metric, RouteButton } from "../components/wallet-ui";
import { View } from "react-native";
import { creditAmount, formatCredit } from "../utils/amount";
import {
  previewBalances,
  previewTransactions,
  previewLedgerEntries,
} from "./fixtures";
import { WalletOverviewContent } from "../components/wallet-overview-content";
import {
  TransactionRow,
  RecordedMovement,
} from "../components/transaction-row";
import { HistoryFilters } from "../components/history-filters";
import type { HistoryFilters as Selection } from "../types/transaction";
import { transactionLabel } from "../utils/transaction-labels";
import { previewHref, previewSelection } from "./navigation";
import { WalletPreparationPreview } from "./preparation";
import { WalletStatusPreview } from "./status";
import { WalletQrPreview } from "./qr";
import { WalletCreatePreview } from "./create";

// Intentionally no query/client/session runtime injection: this is inert UI.
export function WalletPreviewContent() {
  const { view, state, id } = previewSelection(useLocalSearchParams());
  const transaction = previewTransactions.find((entry) => entry.id === id);
  const ledgerEntry = previewLedgerEntries.find((entry) => entry.id === id);
  const router = useRouter();
  const [filters, setFilters] = useState<Selection>({});
  return (
    <FeaturePage
      title="Ví Credit · Xem thử"
      back="/ui"
      backBehavior="history"
      demo
    >
      <Copy>
        Dữ liệu mẫu độc lập, không phản ánh tài khoản đăng nhập và không thu
        tiền.
      </Copy>
      {view === "wallet" && (
        <WalletOverviewContent
          state={{
            status: "ready",
            stale: false,
            data: {
              availableCredit: creditAmount(previewBalances.available),
              heldCredit: creditAmount(previewBalances.held),
              walletVersion: 1,
            },
          }}
          onTopup={() => router.push(previewHref("topup"))}
          onHistory={() => router.push(previewHref("history"))}
        />
      )}
      {(view === "topup" || view === "payment") && (
        <WalletPreparationPreview view={view} />
      )}
      {view === "qr" && <WalletQrPreview />}
      {view === "create" && <WalletCreatePreview />}
      {view === "status" && (
        <>
          <WalletStatusPreview initialState={state} />
          <RouteButton href={previewHref("history")}>
            Xem lịch sử mẫu
          </RouteButton>
        </>
      )}
      {view === "history" && (
        <View>
          <View style={{ marginBottom: 12 }}>
            <HistoryFilters filters={filters} onChange={setFilters} />
          </View>
          {previewLedgerEntries
            .filter(
              (entry) =>
                (!filters.type || entry.type === filters.type) &&
                (!filters.referenceType ||
                  entry.referenceType === filters.referenceType),
            )
            .map((entry) => (
              <TransactionRow
                key={entry.id}
                row={entry}
                onOpen={() =>
                  router.push(previewHref("transaction", undefined, entry.id))
                }
              />
            ))}
        </View>
      )}
      {view === "transaction" && (
        <Panel
          title={
            transaction
              ? transactionLabel(transaction.type)
              : "Không có giao dịch mẫu"
          }
        >
          {transaction ? (
            <>
              <Metric
                label="Số Credit mẫu"
                value={formatCredit(transaction.amount)}
              />
              <Copy>{transaction.context}</Copy>
              {ledgerEntry && <RecordedMovement row={ledgerEntry} />}
              <Copy>{transaction.id}</Copy>
            </>
          ) : (
            <Copy>Liên kết này không chứa mã giao dịch mẫu được hỗ trợ.</Copy>
          )}
        </Panel>
      )}
      <Panel title="Điều hướng bản mẫu">
        {view !== "create" && (
          <RouteButton secondary href={previewHref("create")}>
            Nạp Credit mẫu độc lập
          </RouteButton>
        )}
        <RouteButton secondary href={previewHref("wallet")}>
          Ví mẫu
        </RouteButton>
        {view !== "qr" && (
          <RouteButton secondary href={previewHref("qr")}>
            QR local mẫu độc lập
          </RouteButton>
        )}
        <RouteButton secondary href={previewHref("history")}>
          Lịch sử mẫu
        </RouteButton>
      </Panel>
    </FeaturePage>
  );
}
