import { useState } from "react";
import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { useVisibleListRows } from "@/components/use-visible-list-rows";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import {
  useConnections,
  useConnectionCommand,
  ConnectionFeedback,
} from "@/features/connections";
import { useRefreshWallet } from "@/features/wallet";
import { useMaterialOrderPages, useMaterialsApi } from "../hooks/use-materials";
import type { MaterialOrder } from "../api/material-contracts";
import { materialFailure } from "../utils/material-failure";
import { MaterialOrderCard } from "../components/material-order-card";
import {
  MaterialLibraryHeader,
  type MaterialLibraryFilter,
} from "../components/material-library-header";
import { FreeMaterialsContent } from "./free-materials-content";
import { materialStyles as styles } from "../components/material.styles";

export function MaterialLibraryScreen() {
  return (
    <Redirect
      href={{ pathname: "/materials/mine", params: { tab: "library" } }}
    />
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
export function MaterialLibraryContent() {
  const [filter, setFilter] = useState<MaterialLibraryFilter>("ALL");
  return filter === "FREE" ? (
    <FreeMaterialsContent onChange={setFilter} />
  ) : (
    <PurchasedMaterialsContent filter={filter} onChange={setFilter} />
  );
}
function PurchasedMaterialsContent({
  filter,
  onChange,
}: Readonly<{
  filter: Exclude<MaterialLibraryFilter, "FREE">;
  onChange: (filter: MaterialLibraryFilter) => void;
}>) {
  const runtime = useConnections();
  const query = useMaterialOrderPages();
  const api = useMaterialsApi();
  const cache = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const command = useConnectionCommand<MaterialOrder>([["materials"]]);
  const { visibleIds, ...viewability } = useVisibleListRows();
  const [confirm, setConfirm] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const locked =
    command.pending || command.uncertain || query.isFetching || !!query.error;
  const refresh = async () => {
    if (command.pending || refreshing || query.isFetching) return;
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const finish = async (order: MaterialOrder | undefined) => {
    if (!order || !runtime.isCurrent()) return;
    await cache.cancelQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
    if (!runtime.isCurrent()) return;
    cache.setQueryData(
      [...runtime.key, "materials", "orders", order.materialId],
      null,
    );
    void cache.invalidateQueries({ queryKey: [...runtime.key, "materials"] });
    void refreshWallet()?.catch(() => undefined);
    setConfirm(undefined);
    setNotice("Đã hoàn tiền theo kết quả từ hệ thống.");
  };
  return (
    <>
      <RefreshableFlatList
        data={query.items.filter(
          (row) => filter === "ALL" || row.status === filter,
        )}
        {...viewability}
        extraData={visibleIds}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          <View style={styles.header}>
            <MaterialLibraryHeader
              value={filter}
              onChange={onChange}
              disabled={command.pending || command.uncertain}
            />
            <ConnectionFeedback
              loading={query.isLoading}
              error={query.error}
              retry={query.isFetchNextPageError ? query.fetchNextPage : refresh}
            />
            {!!notice && (
              <FormNotice tone="success" compact>
                {notice}
              </FormNotice>
            )}
            {!!command.error && !confirm && (
              <FormNotice tone="error" compact>
                {materialFailure(command.error)}
              </FormNotice>
            )}
            {command.uncertain && !confirm && (
              <Button
                variant="paper"
                disabled={command.pending}
                onPress={() => void command.retry().then(finish)}
              >
                Kiểm tra yêu cầu hoàn tiền
              </Button>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <MaterialOrderCard
            order={item}
            visible={visibleIds.has(item.id)}
            disabled={locked}
            onRefund={() => {
              if (item.refundEligibility?.canRefund === false) return;
              setConfirm(item.id);
              setNotice(undefined);
            }}
          />
        )}
        ListEmptyComponent={
          query.data && !query.error && !query.isLoading ? (
            <EmptyState
              icon="book"
              title={
                filter === "ALL"
                  ? "Thư viện đang trống"
                  : "Chưa có đơn ở trạng thái này"
              }
              description={
                query.hasNextPage
                  ? "Chọn trạng thái khác hoặc xem thêm đơn mua."
                  : "Tìm một tài liệu hữu ích để bắt đầu."
              }
              titleStyle={styles.heading}
            />
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <View style={styles.footer}>
              <Button
                variant="paper"
                disabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              >
                Xem thêm đơn mua
              </Button>
            </View>
          ) : null
        }
      />
      <InfoModal
        title={confirm ? "Hoàn tiền tài liệu?" : null}
        titleStyle={styles.heading}
        onClose={() => {
          if (!command.pending) setConfirm(undefined);
        }}
        busy={command.pending}
        showConfirm={false}
        footer={
          <View style={styles.row}>
            <Button
              variant="paper"
              disabled={command.pending}
              onPress={() => setConfirm(undefined)}
            >
              Giữ đơn mua
            </Button>
            <Button
              variant="craft"
              disabled={
                command.pending ||
                (!command.uncertain && (query.isFetching || !!query.error)) ||
                (!command.uncertain &&
                  query.items.find((row) => row.id === confirm)
                    ?.refundEligibility?.canRefund === false)
              }
              onPress={() => {
                if (command.uncertain) void command.retry().then(finish);
                else if (confirm)
                  void command
                    .run(`refund:${confirm}`, () => api.refund(confirm))
                    .then(finish);
              }}
            >
              {command.pending
                ? "Đang xử lý…"
                : command.uncertain
                  ? "Kiểm tra yêu cầu"
                  : "Xác nhận hoàn tiền"}
            </Button>
          </View>
        }
      >
        <Text style={styles.text}>
          Hệ thống chỉ hoàn tiền trong 24 giờ khi chưa cấp đường dẫn tải và đủ
          điều kiện hoàn trả. Hoàn tiền thành công sẽ thu hồi quyền truy cập của
          đơn mua.
        </Text>
        {!!command.error && (
          <FormNotice tone="error" compact>
            {materialFailure(command.error)}
          </FormNotice>
        )}
        {command.uncertain && (
          <FormNotice tone="warning" compact>
            Chưa xác nhận được kết quả. Kiểm tra yêu cầu trước khi thao tác
            tiếp.
          </FormNotice>
        )}
      </InfoModal>
    </>
  );
}
