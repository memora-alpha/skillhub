import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, type FlatListProps } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
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
import type { RequestItem } from "../types";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";
export function RequestsFeedScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const proposals = useSentRequestProposals({
    enabled: focused,
    refreshOnFocus: "stale",
  });
  const [visibleIds, setVisibleIds] = useState(new Set<string>());
  const viewabilityConfig = useRef({
    minimumViewTime: 200,
    itemVisiblePercentThreshold: 10,
  }).current;
  const onViewableItemsChanged = useRef<
    NonNullable<FlatListProps<RequestItem>["onViewableItemsChanged"]>
  >(({ viewableItems }) =>
    setVisibleIds(
      new Set(
        viewableItems
          .filter((item) => item.isViewable)
          .map(({ item }) => item.id),
      ),
    ),
  ).current;
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
  const query = useRequestList(
    filters.scope,
    {
      keyword: keyword.trim() || undefined,
      skillId: filters.skillId || undefined,
      tagIds: filters.tagIds.length ? filters.tagIds : undefined,
    },
    focused,
  );
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () =>
      query.isFetchNextPageError ? query.loadMore() : query.refetch(),
  });
  useQuietReadRecovery({
    error: proposals.error,
    fetching: proposals.isFetching,
    enabled: focused,
    retry: () => proposals.refetch({ cancelRefetch: false }),
  });
  const quietError = isTransientReadError(query.error);
  let emptyContent: ReactNode = null;
  if (query.isPending || (!query.data && quietError))
    emptyContent = <RequestLoading />;
  else if (!query.error || (query.data && quietError))
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
          extraData={visibleIds}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          ItemSeparatorComponent={RequestListSeparator}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            void query.refetch();
            void proposals.refetch({ cancelRefetch: false });
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
              {!!proposals.error && !isTransientReadError(proposals.error) && (
                <ConnectionFeedback
                  error={proposals.error}
                  retry={() => void proposals.refetch({ cancelRefetch: false })}
                />
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
              proposal={proposals.data?.[item.id]}
              loadAvatar={focused && visibleIds.has(item.id)}
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
              quietTransient
              loadMore={() => void query.loadMore()}
              reload={() => void query.refetch()}
            />
          }
        />
      )}
    </AppScreenLayout>
  );
}
