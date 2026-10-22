import { useLocalSearchParams } from "expo-router";
import { RefreshControl, StyleSheet } from "react-native";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, Panel, ui } from "../components/wallet-ui";
import { useTransaction } from "../hooks/use-transaction";
import { useWalletBack } from "../hooks/use-wallet-back";
import { FinancialReadState } from "../components/financial-read-state";
import { TransactionReceipt } from "../components/transaction-receipt";
import { paymentPalette as colors } from "../components/wallet-payment-palette";

export function TransactionDetail() {
  const params = useLocalSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { valid, state, refresh } = useTransaction(id);
  const onBack = useWalletBack("transaction");
  return (
    <AppScreenLayout
      title="Chi tiết giao dịch"
      centeredTitle
      contentStyle={{ backgroundColor: colors.surface }}
      selected="Hồ sơ"
      back={{ href: "/wallet/history", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={[ui.page, styles.page]}
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
            <FinancialReadState
              state={state}
              onRetry={() => void refresh()}
              refreshIndicator="pull"
            >
              {state.data && <TransactionReceipt row={state.data} />}
            </FinancialReadState>
          )}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  page: {
    maxWidth: 560,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 32,
  },
});
