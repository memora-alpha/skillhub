import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { Copy, Panel, ui } from "@/components/feature-page";
import { useTransactions } from "../hooks/use-transactions";
import { useWalletBack } from "../hooks/use-wallet-back";
import { FinancialReadState } from "../components/financial-read-state";
import { HistoryFilters } from "../components/history-filters";
import { TransactionRow } from "../components/transaction-row";

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
          contentContainerStyle={[ui.page, { gap: 12 }]}
          initialNumToRender={8}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Panel title="Lọc lịch sử">
                <HistoryFilters
                  filters={history.filters}
                  onChange={history.select}
                />
              </Panel>
              <FinancialReadState
                state={state}
                onRetry={() => void history.refresh()}
              />
              {state.status === "empty" && (
                <Copy muted>
                  {history.filters.type || history.filters.referenceType
                    ? "Không có giao dịch theo bộ lọc này. Bạn có thể xóa bộ lọc."
                    : "Giao dịch của bạn sẽ xuất hiện tại đây khi được ghi nhận."}
                </Copy>
              )}
              {state.data && (
                <Button
                  variant="paper"
                  disabled={history.busy}
                  onPress={() => void history.refresh()}
                >
                  Cập nhật lịch sử
                </Button>
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
            <View style={{ gap: 12 }}>
              {state.data && (
                <Copy muted>Đã tải {state.data.length} giao dịch</Copy>
              )}
              {history.invalidCursor ? (
                <>
                  <Copy>
                    Không thể tiếp tục trang hiện tại. Hãy tải lại lịch sử.
                  </Copy>
                  <Button disabled={history.busy} onPress={history.restart}>
                    Tải lại lịch sử
                  </Button>
                </>
              ) : (
                history.hasMore && (
                  <>
                    <Copy muted>
                      {history.pageError
                        ? "Chưa tải được trang tiếp theo. Các giao dịch đã tải vẫn được giữ."
                        : history.loadingMore
                          ? "Đang tải thêm giao dịch"
                          : ""}
                    </Copy>
                    <Button
                      variant="paper"
                      disabled={history.busy}
                      onPress={() => void history.loadMore()}
                    >
                      {history.loadingMore
                        ? "Đang tải thêm…"
                        : history.pageError
                          ? "Thử lại trang tiếp theo"
                          : "Tải thêm giao dịch"}
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
