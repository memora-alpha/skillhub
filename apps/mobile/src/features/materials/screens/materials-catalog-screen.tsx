import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { uuid } from "@/lib/http/contracts";
import { FeaturePage } from "@/components/feature-page";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { useMaterialSearch } from "../hooks/use-materials";
import { CatalogMaterialCard } from "../components/material-summary";
import {
  MaterialCatalogFilters,
  emptyCatalogFilter,
  type MaterialCatalogFilter,
} from "../components/material-catalog-filters";
import { materialStyles as styles } from "../components/material.styles";

export function MaterialsScreen() {
  return (
    <FeaturePage
      title="Tài liệu học tập"
      section="Khám phá"
      back="/discover"
      backBehavior="history"
      scrollable={false}
    >
      <MaterialsCatalogContent />
    </FeaturePage>
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
export function MaterialsCatalogContent() {
  const params = useLocalSearchParams<{ skillId?: string }>();
  const initialSkill = uuid.safeParse(params.skillId).success
    ? params.skillId!
    : "";
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [filters, setFilters] =
    useState<MaterialCatalogFilter>(emptyCatalogFilter);
  const [refreshing, setRefreshing] = useState(false);
  const query = useMaterialSearch(
    term,
    filters.access === "ALL" ? undefined : filters.access,
    filters.skillId || undefined,
  );
  const router = useRouter();
  useEffect(() => {
    setFilters({ ...emptyCatalogFilter, skillId: initialSkill });
  }, [initialSkill]);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const refresh = async () => {
    if (refreshing || query.isFetching) return;
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <RefreshableFlatList
      data={query.items}
      keyExtractor={(row) => row.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      ListHeaderComponent={
        <View style={styles.header}>
          <MaterialCatalogFilters
            search={search}
            onSearch={setSearch}
            onSubmit={() => setTerm(search.trim())}
            filters={filters}
            onApply={setFilters}
          />
          <View style={styles.row}>
            <Text style={styles.meta}>
              {query.total !== undefined
                ? `${query.total} tài liệu`
                : "Tài liệu"}
            </Text>
          </View>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.isFetchNextPageError ? query.fetchNextPage : refresh}
          />
        </View>
      }
      renderItem={({ item }) => (
        <CatalogMaterialCard
          material={item}
          onPress={() => router.push(`/materials/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        query.data && !query.error && !query.isLoading ? (
          <EmptyState
            icon="book"
            title="Chưa có tài liệu phù hợp"
            description="Thử từ khóa hoặc kỹ năng khác."
            titleStyle={styles.heading}
            action="Bỏ bộ lọc"
            onAction={() => {
              setFilters(emptyCatalogFilter);
              setSearch("");
              setTerm("");
            }}
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
              {query.isFetchingNextPage ? "Đang tải…" : "Xem thêm tài liệu"}
            </Button>
          </View>
        ) : null
      }
    />
  );
}
