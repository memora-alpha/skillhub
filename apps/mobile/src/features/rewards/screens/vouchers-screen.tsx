import { useMemo, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { FilterBar } from "@/components/filter-bar";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { appColors } from "@/constants/theme";
import { useRewardProducts, useRedemptions } from "../hooks/use-rewards";
import { RewardCard, RedemptionCard } from "../components/reward-card";
import { RedemptionRecovery } from "../components/redemption-recovery";
import { VoucherTabs } from "../components/voucher-tabs";
import { filterProducts } from "../utils/reward-presentation";
import { rewardStyles as s } from "../components/reward.styles";

export function VouchersScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const tab = params.tab === "mine" ? "mine" : "catalog";
  return (
    <FeaturePage
      title="Voucher"
      back="/wallet"
      backBehavior="history"
      scrollable={false}
    >
      <VoucherTabs
        value={tab}
        onChange={(value) => router.setParams({ tab: value })}
      />
      {tab === "catalog" ? <Catalog /> : <MyVouchers />}
    </FeaturePage>
  );
}
function Separator() {
  return <View style={s.separator} />;
}
function Catalog() {
  const query = useRewardProducts();
  const router = useRouter();
  const products = query.data ?? [];
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.3 ? 1 : 2;
  const categories = useMemo(
    () =>
      [
        ...new Set(
          products.map((p) => p.category).filter((p): p is string => !!p),
        ),
      ].sort((a, b) => a.localeCompare(b, "vi")),
    [products],
  );
  const items = filterProducts(products, search, category);
  return (
    <RefreshableFlatList
      key={columns}
      numColumns={columns}
      data={items}
      keyExtractor={(row) => row.id}
      columnWrapperStyle={columns > 1 ? s.columns : undefined}
      contentContainerStyle={s.content}
      ItemSeparatorComponent={Separator}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
      ListHeaderComponent={
        <View style={s.header}>
          <RedemptionRecovery />
          <Input
            label="Tìm voucher hoặc thương hiệu"
            hideLabel
            placeholder="Tìm voucher, thương hiệu…"
            value={search}
            onChangeText={setSearch}
            rightAccessory={<Icon name="search" color={appColors.muted} />}
          />
          {categories.length > 0 && (
            <FilterBar
              label="Danh mục voucher"
              role="radio"
              value={category}
              options={[
                { value: "", label: "Tất cả" },
                ...categories.map((value) => ({ value, label: value })),
              ]}
              onChange={setCategory}
            />
          )}
          {query.data && <Text style={s.muted}>{items.length} voucher</Text>}
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={() => query.refetch()}
          />
        </View>
      }
      renderItem={({ item }) => (
        <RewardCard
          product={item}
          halfWidth={columns > 1}
          onPress={() => router.push(`/vouchers/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        query.data && !query.isLoading && !query.error ? (
          <EmptyState
            icon="ticket"
            titleStyle={s.heading}
            title={
              products.length ? "Chưa tìm thấy voucher" : "Chưa có voucher"
            }
            description={
              products.length
                ? "Thử thương hiệu khác hoặc bỏ bộ lọc."
                : "Thử lại sau để khám phá các voucher mới nhất."
            }
            action={products.length ? "Bỏ bộ lọc" : undefined}
            onAction={() => {
              setSearch("");
              setCategory("");
            }}
          />
        ) : null
      }
    />
  );
}
function MyVouchers() {
  const query = useRedemptions();
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const items = query.items.filter(
    (row) =>
      filter === "ALL" ||
      (filter === "ISSUED"
        ? row.status === "ISSUED"
        : ["ISSUING", "MANUAL_REVIEW"].includes(row.status)),
  );
  return (
    <RefreshableFlatList
      data={items}
      keyExtractor={(row) => row.id}
      contentContainerStyle={s.content}
      ItemSeparatorComponent={Separator}
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
      ListHeaderComponent={
        <View style={s.header}>
          <RedemptionRecovery />
          <FilterBar
            label="Lọc voucher đã đổi"
            role="radio"
            value={filter}
            options={[
              { value: "ALL", label: "Tất cả" },
              { value: "ISSUED", label: "Đã phát hành" },
              { value: "PENDING", label: "Đang xử lý" },
            ]}
            onChange={setFilter}
          />
          {query.data && (
            <Text style={s.muted}>{items.length} voucher đã tải</Text>
          )}
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={() =>
              query.isFetchNextPageError
                ? query.fetchNextPage()
                : query.refetch()
            }
          />
        </View>
      }
      renderItem={({ item }) => (
        <RedemptionCard
          redemption={item}
          onPress={() => router.push(`/vouchers/mine/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        query.data && !query.error && !query.isLoading ? (
          <EmptyState
            icon="ticket"
            titleStyle={s.heading}
            title="Chưa có voucher phù hợp"
            description={
              query.hasNextPage
                ? "Xem thêm lịch sử để tìm voucher phù hợp."
                : "Voucher đã đổi sẽ xuất hiện ở đây để bạn theo dõi và xem mã."
            }
          />
        ) : null
      }
      ListFooterComponent={
        query.hasNextPage ? (
          <Button
            variant="paper"
            disabled={query.isFetching}
            onPress={() => {
              void query.fetchNextPage();
            }}
          >
            {query.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
          </Button>
        ) : null
      }
    />
  );
}
