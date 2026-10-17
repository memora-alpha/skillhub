import { useLocalSearchParams } from "expo-router";
import {
  FeaturePage,
  Panel,
  Copy,
  Metric,
  RouteButton,
  ui,
} from "@/components/feature-page";
import { View } from "react-native";
import { formatCredit } from "../utils/amount";
import { previewBalances, previewTransactions } from "./fixtures";
import { previewHref, previewSelection } from "./navigation";
import { WalletPreparationPreview } from "./preparation";
import { WalletStatusPreview } from "./status";

// Intentionally no query/client/session runtime injection: this is inert UI.
export function WalletPreviewContent() {
  const { view, state, id } = previewSelection(useLocalSearchParams());
  const transaction = previewTransactions.find((entry) => entry.id === id);
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
        <Panel title="Ví tài khoản mẫu">
          <View style={ui.row}>
            <Metric
              label="Khả dụng mẫu"
              value={formatCredit(previewBalances.available)}
            />
            <Metric
              label="Đang tạm giữ mẫu"
              value={formatCredit(previewBalances.held)}
            />
          </View>
        </Panel>
      )}
      {(view === "topup" || view === "payment") && (
        <WalletPreparationPreview view={view} />
      )}
      {view === "status" && (
        <>
          <WalletStatusPreview initialState={state} />
          <RouteButton href={previewHref("history")}>
            Xem lịch sử mẫu
          </RouteButton>
        </>
      )}
      {view === "history" &&
        previewTransactions.map((entry) => (
          <Panel key={entry.id} title={entry.type}>
            <Metric label="Số Credit mẫu" value={formatCredit(entry.amount)} />
            <Copy>
              {entry.status} · {entry.context}
            </Copy>
            <RouteButton
              secondary
              href={previewHref("transaction", undefined, entry.id)}
            >
              Xem giao dịch mẫu
            </RouteButton>
          </Panel>
        ))}
      {view === "transaction" && (
        <Panel title={transaction?.type ?? "Không có giao dịch mẫu"}>
          {transaction ? (
            <>
              <Metric
                label="Số Credit mẫu"
                value={formatCredit(transaction.amount)}
              />
              <Copy>{transaction.context}</Copy>
              <Copy>{transaction.id}</Copy>
            </>
          ) : (
            <Copy>Liên kết này không chứa mã giao dịch mẫu được hỗ trợ.</Copy>
          )}
        </Panel>
      )}
      <RouteButton secondary href={previewHref("wallet")}>
        Ví mẫu
      </RouteButton>
      <RouteButton secondary href={previewHref("history")}>
        Lịch sử mẫu
      </RouteButton>
    </FeaturePage>
  );
}
