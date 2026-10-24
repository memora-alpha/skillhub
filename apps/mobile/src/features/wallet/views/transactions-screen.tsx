import { StyleSheet, Text, View } from "react-native";
import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { Copy, ui } from "../components/wallet-ui";
import { useTransactions } from "../hooks/use-transactions";
import { useWalletBack } from "../hooks/use-wallet-back";
import { FinancialReadState } from "../components/financial-read-state";
import { HistoryFilters } from "../components/history-filters";
import { TransactionRow } from "../components/transaction-row";
import { fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "../components/wallet-payment-palette";

export function TransactionHistory() {
  const history = useTransactions(),
    router = useRouter(),
    onBack = useWalletBack("history");
  const { state } = history;
  return (
    <AppScreenLayout
      title="Lịch sử giao dịch"
      centeredTitle
      contentStyle={{ backgroundColor: colors.surface }}
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <FlatList
          data={state.data ?? []}
          keyExtractor={(row) => row.id}
          contentContainerStyle={[ui.page, styles.page]}
          initialNumToRender={8}
          refreshing={state.status === "refreshing"}
          onRefresh={() => void history.refresh()}
          ListHeaderComponent={
            <View style={styles.toolbar}>
              <HistoryFilters
                filters={history.filters}
                onChange={history.select}
              />
              {state.status !== "empty" && (
                <FinancialReadState
                  state={state}
                  refreshIndicator="pull"
                  onRetry={() => void history.refresh()}
                />
              )}
              {state.status === "empty" && (
                <View style={styles.empty}>
                  <Text accessibilityRole="header" style={ui.heading}>
                    Chưa có giao dịch
                  </Text>
                  <Text style={styles.emptyCopy}>
                    {history.filters.type || history.filters.referenceType
                      ? "Chưa có giao dịch trong nhóm này. Chọn Tất cả để xem các nhóm khác."
                      : "Lịch sử sẽ xuất hiện tại đây khi giao dịch được ghi nhận."}
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TransactionRow
              row={item}
              onOpen={() =>
                router.push({
                  pathname: "/wallet/transactions/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              {history.invalidCursor ? (
                <>
                  <Copy>
                    Chưa thể xem tiếp danh sách này. Làm mới lịch sử để cập nhật
                    giao dịch.
                  </Copy>
                  <Button disabled={history.busy} onPress={history.restart}>
                    Làm mới lịch sử
                  </Button>
                </>
              ) : (
                history.hasMore && (
                  <>
                    {history.pageError && !history.loadingMore && (
                      <Copy muted>
                        Chưa tải được thêm giao dịch. Bạn vẫn có thể xem các
                        giao dịch bên trên.
                      </Copy>
                    )}
                    <Button
                      variant="paper"
                      disabled={history.busy}
                      onPress={() => void history.loadMore()}
                    >
                      {history.loadingMore
                        ? "Đang tải thêm…"
                        : history.pageError
                          ? "Thử lại"
                          : "Xem thêm"}
                    </Button>
                  </>
                )
              )}
            </View>
          }
        />
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
    gap: 0,
  },
  toolbar: { padding: 16, gap: 12 },
  footer: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  empty: {
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  emptyCopy: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
});
