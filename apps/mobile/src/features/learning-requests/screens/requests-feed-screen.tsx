import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { EmptyState } from "@/components/EmptyState";
import { RequestCard } from "../components/request-card";
import {
  RequestFeedFilters,
  type FeedFilters,
} from "../components/request-feed-filters";
import {
  RequestCreateButton,
  RequestListSummary,
} from "../components/request-list-controls";
import { requestListStyles as styles } from "../components/request-list.styles";
import { RequestLoading, RequestFailure } from "../components/request-state";
import { RequestListFooter } from "../components/request-list-footer";
import { useRequestList } from "../hooks/use-requests";
import { isOwnRequest } from "../utils/request-policy";
import { RequestListSeparator } from "../components/request-list-separator";
import { useSentRequestProposals } from "@/features/proposals/state";
import { ConnectionFeedback } from "@/features/connections";
export function RequestsFeedScreen() {
  const router = useRouter();
  const proposals = useSentRequestProposals();
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const initial = typeof params.query === "string" ? params.query : "";
  const [search, setSearch] = useState(initial);
  const [keyword, setKeyword] = useState(initial);
  const [filters, setFilters] = useState<FeedFilters>({
    scope: "feed",
    skillId: "",
    tagIds: [],
  });
  useEffect(() => {
    setSearch(initial);
    setKeyword(initial);
  }, [initial]);
  useEffect(() => {
    const timer = setTimeout(
      () => setKeyword(search.normalize("NFKC").trim()),
      350,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const query = useRequestList(filters.scope, {
    keyword: keyword.trim() || undefined,
    skillId: filters.skillId || undefined,
    tagIds: filters.tagIds.length ? filters.tagIds : undefined,
  });
  let emptyContent: ReactNode = null;
  if (query.isPending) emptyContent = <RequestLoading />;
  else if (!query.error)
    emptyContent = (
      <EmptyState
        title="Chưa có yêu cầu phù hợp"
        description="Thử từ khóa khác hoặc quay lại tất cả yêu cầu."
        titleStyle={styles.heading}
      />
    );
  return (
    <AppScreenLayout
      title="Yêu cầu học"
      selected="Khám phá"
      rightAction={<RequestCreateButton />}
    >
      {() => (
        <FlatList
          data={query.items}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={RequestListSeparator}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            void query.refetch();
            void proposals.refetch();
          }}
          ListHeaderComponent={
            <View style={styles.header}>
              <RequestFeedFilters
                search={search}
                onSearch={setSearch}
                onSubmit={() => setKeyword(search.normalize("NFKC").trim())}
                filters={filters}
                onApply={setFilters}
              />
              {query.data && (
                <RequestListSummary
                  count={query.items.length}
                  recommended={filters.scope === "recommended"}
                />
              )}
              {!!proposals.error && (
                <ConnectionFeedback
                  error={proposals.error}
                  retry={proposals.refetch}
                />
              )}
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
              proposal={proposals.data?.[item.id]}
              onPress={() =>
                router.navigate(
                  isOwnRequest(item)
                    ? `/requests/${item.id}`
                    : `/request/${item.id}`,
                )
              }
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
      )}
    </AppScreenLayout>
  );
}
