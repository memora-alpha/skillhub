import type { ReactElement } from "react";
import { View } from "react-native";
import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { ui } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import type { useProposalList } from "../hooks/use-proposals-api";
import { searchProposals } from "../utils/search-proposals";
import { ProposalListCard } from "./ProposalListCard";

export function ProposalList({
  query,
  header,
  empty,
  keyword = "",
  requestId,
  quiet = false,
}: Readonly<{
  query: ReturnType<typeof useProposalList>;
  header: ReactElement;
  empty: ReactElement;
  keyword?: string;
  requestId?: string;
  quiet?: boolean;
}>) {
  const hasMore = query.hasNextPage && !query.denied;
  const loadMore = () => void query.fetchNextPage({ cancelRefetch: false });
  return (
    <FlatList
      data={searchProposals(query.items, keyword)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      keyExtractor={(item) => item.id}
      contentContainerStyle={[ui.page, { paddingTop: 0 }]}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (hasMore && !query.isFetching && !query.error) loadMore();
      }}
      ItemSeparatorComponent={ProposalSeparator}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 16 }}>
          {header}
          <ConnectionFeedback
            loading={query.isLoading || (!query.data && quiet)}
            error={quiet ? undefined : query.error}
            retry={query.refetch}
          />
        </View>
      }
      ListEmptyComponent={!query.isPending && !query.error ? empty : null}
      ListFooterComponent={
        hasMore ? (
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onPress={loadMore}
          >
            Tải thêm đề xuất
          </Button>
        ) : null
      }
      renderItem={({ item }) => (
        <ProposalListCard
          proposal={item}
          returnRequestId={requestId}
          compact={!!requestId}
        />
      )}
    />
  );
}

function ProposalSeparator() {
  return <View style={{ height: 12 }} />;
}
