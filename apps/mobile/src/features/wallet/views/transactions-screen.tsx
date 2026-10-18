import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { Copy, ui } from "../components/wallet-ui";
import { useTransactions } from "../hooks/use-transactions";
import { useWalletBack } from "../hooks/use-wallet-back";
import { FinancialReadState } from "../components/financial-read-state";
import { HistoryFilters } from "../components/history-filters";
import { TransactionRow } from "../components/transaction-row";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function TransactionHistory() {
  const history = useTransactions(),
    router = useRouter(),
    onBack = useWalletBack("history");
  const { state } = history;
  return (
    <AppScreenLayout
      title="Lịch sử giao dịch"
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <FlatList
          data={state.data ?? []}
          keyExtractor={(row) => row.id}
          contentContainerStyle={[ui.page, { gap: 0 }]}
          initialNumToRender={8}
          refreshControl={
            <RefreshControl
              refreshing={state.status === "refreshing"}
              onRefresh={() => void history.refresh()}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 12 }}>
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
                  <View style={styles.emptyIcon}>
                    <Icon
                      name="clipboard"
                      size={24}
                      color={colors.primaryDark}
                    />
                  </View>
                  <Text accessibilityRole="header" style={ui.heading}>
                    Chưa có giao dịch
                  </Text>
                  <Text style={styles.emptyCopy}>
                    {history.filters.type || history.filters.referenceType
                      ? "Chưa có giao dịch trong nhóm này. Chọn Tất cả giao dịch để xem các nhóm khác."
                      : "Lịch sử sẽ xuất hiện tại đây khi giao dịch được ghi nhận."}
                  </Text>
                </View>
              )}
              {!!state.data?.length && (
                <View style={styles.listHeading}>
                  <Text accessibilityRole="header" style={ui.heading}>
                    Giao dịch
                  </Text>
                  <View style={styles.order}>
                    <Icon name="clock" size={14} color={colors.muted} />
                    <Text style={styles.caption}>Mới nhất trước</Text>
                  </View>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <TransactionRow
              row={item}
              position={
                index === 0
                  ? state.data?.length === 1
                    ? "only"
                    : "first"
                  : index === (state.data?.length ?? 0) - 1
                    ? "last"
                    : "middle"
              }
              onOpen={() =>
                router.push({
                  pathname: "/wallet/transactions/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          ListFooterComponent={
            <View style={{ gap: 12, marginTop: 16 }}>
              {!!state.data?.length && (
                <Copy muted>Đang hiển thị {state.data.length} giao dịch</Copy>
              )}
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
  order: { flexDirection: "row", alignItems: "center", gap: 6 },
  listHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  empty: {
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  emptyIcon: {
    padding: 14,
    borderRadius: appRadius.full,
    backgroundColor: colors.primarySoft,
  },
  emptyCopy: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
});
