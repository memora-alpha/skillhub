import { useLocalSearchParams } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { Copy, Panel, ui } from "@/components/feature-page";
import { useTransaction } from "../hooks/use-transaction";
import { useWalletBack } from "../hooks/use-wallet-back";
import { RecordedMovement } from "../components/transaction-row";
import { FinancialReadState } from "../components/financial-read-state";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
} from "../utils/transaction-labels";

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
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          {!valid ? (
            <Panel>
              <Copy>
                Mã giao dịch không hợp lệ. Bạn có thể quay lại lịch sử.
              </Copy>
            </Panel>
          ) : (
            <Panel title="Giao dịch đã ghi nhận">
              <FinancialReadState state={state} onRetry={() => void refresh()}>
                {row && (
                  <>
                    <Copy>
                      {transactionLabel(row.type)} ·{" "}
                      {transactionStatus(row.status)}
                    </Copy>
                    <Copy>{transactionTime(row.createdAt)}</Copy>
                    <RecordedMovement row={row} />
                    <Copy>Mã giao dịch: {row.id}</Copy>
                    <Copy>Mã nghiệp vụ: {row.operationId}</Copy>
                    <Copy>Loại tham chiếu: {row.referenceType}</Copy>
                    <Copy>
                      Tham chiếu: {row.referenceId || "Chưa có thông tin"}
                    </Copy>
                    {row.reversesTransactionId && (
                      <Copy>Đảo giao dịch: {row.reversesTransactionId}</Copy>
                    )}
                  </>
                )}
              </FinancialReadState>
              {state.status === "ready" && (
                <Button variant="paper" onPress={() => void refresh()}>
                  Cập nhật giao dịch
                </Button>
              )}
            </Panel>
          )}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
