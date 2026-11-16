import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { useMaterialFavorites } from "../hooks/use-material-favorites";
import { MaterialCover } from "../components/material-cover";
import { MaterialFavoriteButton } from "../components/material-favorite-button";
import { materialPrice } from "../utils/owner-material-presentation";
import { materialStyles as styles } from "../components/material.styles";

export function SavedMaterialsContent() {
  const query = useMaterialFavorites();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
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
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      ListHeaderComponent={
        <ConnectionFeedback
          loading={query.isLoading}
          error={query.error}
          retry={query.isFetchNextPageError ? query.fetchNextPage : refresh}
        />
      }
      renderItem={({ item }) => (
        <View style={styles.catalogCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem ${item.material.title}`}
            style={[styles.catalogRow, styles.savedCardRow]}
            onPress={() => router.push(`/materials/${item.material.id}`)}
          >
            <MaterialCover material={item.material} />
            <View style={styles.catalogContent}>
              <Text style={styles.title} numberOfLines={2}>
                {item.material.title}
              </Text>
              <Text style={styles.caption} numberOfLines={2}>
                {item.material.description}
              </Text>
              <Text style={styles.price}>{materialPrice(item.material)}</Text>
            </View>
          </Pressable>
          <MaterialFavoriteButton
            materialId={item.material.id}
            saved
            iconOnly
            style={styles.savedFavorite}
          />
        </View>
      )}
      ListEmptyComponent={
        query.data && !query.error ? (
          <EmptyState
            icon="book"
            title="Chưa lưu tài liệu nào"
            titleStyle={styles.heading}
            description="Lưu tài liệu bạn quan tâm từ trang chi tiết để xem lại tại đây."
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
              Xem thêm tài liệu đã lưu
            </Button>
          </View>
        ) : null
      }
    />
  );
}
