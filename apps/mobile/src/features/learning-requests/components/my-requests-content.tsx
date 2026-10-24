import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { LoadingIndicator } from "@/components/LoadingIndicator";

import {
  RequestTabs,
  RequestListSummary,
} from "../components/request-list-controls";
import { requestListStyles as styles } from "../components/request-list.styles";
import { RequestCard } from "../components/request-card";
import { RequestFailure, RequestLoading } from "../components/request-state";
import { RequestListFooter } from "../components/request-list-footer";
import { useRequestList } from "../hooks/use-requests";
import { requestStatuses } from "../types";
import { RequestListSeparator } from "./request-list-separator";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";
export function MyRequestsContent({
  embedded = false,
}: Readonly<{
  embedded?: boolean;
}>) {
  const [status, setStatus] = useState("Tất cả");
  const focused = useIsFocused();
  const query = useRequestList(
    "mine",
    status === "Tất cả" ? {} : { status },
    focused,
  );
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () =>
      query.isFetchNextPageError ? query.loadMore() : query.refetch(),
  });
  const quietError = isTransientReadError(query.error);
  const router = useRouter();
  let emptyContent: ReactNode = null;
  if (query.isPending || (!query.items.length && quietError))
    emptyContent = <RequestLoading />;
  else if (!query.error || (query.data && quietError))
    emptyContent = (
      <EmptyState
        title={
          status === "Tất cả"
            ? "Bạn chưa có yêu cầu học"
            : "Không có yêu cầu ở trạng thái này"
        }
        description="Tạo một yêu cầu mới hoặc chọn trạng thái khác."
        titleStyle={styles.heading}
      />
    );
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      data={query.items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.content,
        embedded && styles.embeddedContent,
      ]}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={RequestListSeparator}
      onEndReached={() => void query.autoLoadMore()}
      onEndReachedThreshold={0.4}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      ListHeaderComponent={
        <View style={styles.header}>
          <RequestTabs
            label="Trạng thái"
            options={["Tất cả", ...requestStatuses]}
            value={status}
            onChange={setStatus}
          />
          {query.data && <RequestListSummary count={query.items.length} />}
          {quietError &&
            !!query.items.length &&
            !query.isFetchNextPageError && (
              <LoadingIndicator accessibilityLabel="Đang cập nhật yêu cầu học" />
            )}
          {query.error && !quietError && !query.isFetchNextPageError && (
            <RequestFailure
              error={query.error}
              retry={() => void query.refetch()}
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <RequestCard
          request={item}
          onPress={() => router.navigate(`/requests/${item.id}`)}
        />
      )}
      ListEmptyComponent={emptyContent}
      ListFooterComponent={
        <RequestListFooter
          hasNextPage={query.hasNextPage}
          fetching={query.isFetching}
          fetchingNext={query.isFetchingNextPage}
          nextError={query.isFetchNextPageError ? query.error : undefined}
          quietTransient
          loadMore={() => void query.loadMore()}
          reload={() => void query.refetch()}
        />
      }
    />
  );
}
