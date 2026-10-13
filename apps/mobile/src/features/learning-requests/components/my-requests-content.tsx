import { useState, type ReactNode } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { EmptyState } from "@/components/EmptyState";

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
export function MyRequestsContent({
  embedded = false,
}: Readonly<{
  embedded?: boolean;
}>) {
  const [status, setStatus] = useState("Tất cả");
  const query = useRequestList("mine", status === "Tất cả" ? {} : { status });
  const router = useRouter();
  let emptyContent: ReactNode = null;
  if (query.isPending) emptyContent = <RequestLoading />;
  else if (!query.error)
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
          {query.error && !query.isFetchNextPageError && (
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
          loadMore={() => void query.loadMore()}
          reload={() => void query.refetch()}
        />
      }
    />
  );
}
