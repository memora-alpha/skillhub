import { useLocalSearchParams } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { RefreshControl, Text, View } from "react-native";
import { Copy, Panel, WalletField, ui } from "../components/wallet-ui";
import { useTransaction } from "../hooks/use-transaction";
import { useWalletBack } from "../hooks/use-wallet-back";
import { RecordedMovement } from "../components/transaction-row";
import { FinancialReadState } from "../components/financial-read-state";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
  referenceLabel,
} from "../utils/transaction-labels";
import { formatCredit } from "../utils/amount";

export function TransactionDetail() {
  const params = useLocalSearchParams(),
    id = typeof params.id === "string" ? params.id : "";
  const { valid, state, refresh } = useTransaction(id),
    onBack = useWalletBack("transaction"),
    row = state.data;
  return (
    <AppScreenLayout
      title="Chi tiết giao dịch"
      selected="Hồ sơ"
      back={{ href: "/wallet/history", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={ui.page}
          refreshControl={
            <RefreshControl
              refreshing={state.status === "refreshing"}
              onRefresh={() => void refresh()}
            />
          }
        >
          {!valid ? (
            <Panel>
              <Copy>
                Mã giao dịch không hợp lệ. Bạn có thể quay lại lịch sử.
              </Copy>
            </Panel>
          ) : (
            <Panel>
              <FinancialReadState
                state={state}
                onRetry={() => void refresh()}
                refreshIndicator="pull"
              >
                {row && (
                  <>
                    <View style={{ gap: 8 }}>
                      <Text style={ui.heading}>
                        {transactionLabel(row.type)}
                      </Text>
                      <Text selectable style={ui.number}>
                        {formatCredit(row.amount)}
                      </Text>
                      <Copy>
                        {transactionStatus(row.status)} ·{" "}
                        {transactionTime(row.createdAt)}
                      </Copy>
                    </View>
                    <RecordedMovement row={row} />
                    <WalletField label="Mã giao dịch" value={row.id} />
                    <WalletField label="Mã nghiệp vụ" value={row.operationId} />
                    <WalletField
                      label="Loại tham chiếu"
                      value={referenceLabel(row.referenceType)}
                    />
                    <WalletField
                      label="Tham chiếu"
                      value={row.referenceId || "Chưa có thông tin"}
                    />
                    {row.reversesTransactionId && (
                      <WalletField
                        label="Đảo giao dịch"
                        value={row.reversesTransactionId}
                      />
                    )}
                  </>
                )}
              </FinancialReadState>
            </Panel>
          )}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
