import { useState } from "react";
import { View } from "react-native";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { useVisibleListRows } from "@/components/use-visible-list-rows";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { AppError } from "@/lib/http/errors";
import { ConnectionFeedback } from "@/features/connections";
import { useFreeMaterialLibrary } from "../hooks/use-free-material-library";
import {
  MaterialLibraryHeader,
  type MaterialLibraryFilter,
} from "../components/material-library-header";
import { FreeMaterialCard } from "../components/free-material-card";
import { materialStyles as styles } from "../components/material.styles";

function Separator() {
  return <View style={styles.separator} />;
}
export function FreeMaterialsContent({
  onChange,
}: Readonly<{
  onChange: (filter: MaterialLibraryFilter) => void;
}>) {
  const query = useFreeMaterialLibrary();
  const { visibleIds, ...viewability } = useVisibleListRows();
  const [refreshing, setRefreshing] = useState(false);
  const unavailable =
    query.error instanceof AppError &&
    query.error.code === "MATERIAL_FREE_LIBRARY_UNAVAILABLE";
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
      {...viewability}
      extraData={visibleIds}
      keyExtractor={(row) => row.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      ListHeaderComponent={
        <View style={styles.header}>
          <MaterialLibraryHeader value="FREE" onChange={onChange} />
          <ConnectionFeedback
            loading={query.isLoading}
            error={unavailable ? undefined : query.error}
            retry={query.isFetchNextPageError ? query.fetchNextPage : refresh}
          />
          {unavailable && (
            <>
              <FormNotice tone="info" compact>
                Thư viện miễn phí tạm thời chưa khả dụng. Vui lòng thử lại sau.
              </FormNotice>
              <Button
                variant="paper"
                size="sm"
                disabled={query.isFetching}
                onPress={() => void refresh()}
              >
                Thử tải lại
              </Button>
            </>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <FreeMaterialCard access={item} visible={visibleIds.has(item.id)} />
      )}
      ListEmptyComponent={
        query.data && !query.error && !query.isLoading ? (
          <EmptyState
            icon="download"
            title="Chưa có tài liệu miễn phí đã tải"
            titleStyle={styles.heading}
            description="Tài liệu miễn phí đã được cấp đường dẫn tải sẽ xuất hiện tại đây khi còn được chia sẻ."
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
              Xem thêm tài liệu miễn phí
            </Button>
          </View>
        ) : null
      }
    />
  );
}
