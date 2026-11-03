import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useIsFocused } from "expo-router";
import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { useConversationInbox } from "../hooks/use-conversation-inbox";
import { ConversationRow } from "./ConversationRow";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";

export function RequestChatsContent({
  requestId,
  title,
}: Readonly<{ requestId: string; title: string }>) {
  const focused = useIsFocused();
  const query = useConversationInbox({ learningRequestId: requestId });
  const hasMore = !!query.hasNextPage && !query.denied;
  const quiet = isTransientReadError(query.error);
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () =>
      query.isFetchNextPageError
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch(),
  });
  useEffect(() => {
    if (
      focused &&
      !query.items.length &&
      hasMore &&
      !query.isFetching &&
      !query.error
    )
      void query.fetchNextPage({ cancelRefetch: false });
  }, [
    focused,
    query.items.length,
    hasMore,
    query.isFetching,
    query.error,
    query.fetchNextPage,
  ]);
  return (
    <FlatList
      data={query.items}
      keyExtractor={(item) => item.conversation.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (hasMore && !query.isFetching && !query.error)
          void query.fetchNextPage({ cancelRefetch: false });
      }}
      ListHeaderComponent={
        <ConnectionFeedback
          loading={
            !query.items.length &&
            (query.isPending || (hasMore && !query.error) || quiet)
          }
          error={quiet ? undefined : query.error}
          retry={query.refetch}
        />
      }
      ListEmptyComponent={
        !query.isPending && !query.error && !hasMore ? (
          <EmptyState
            title="Chưa có cuộc trò chuyện"
            description="Khi đề xuất được chấp nhận, cuộc trò chuyện sẽ xuất hiện tại đây."
          />
        ) : null
      }
      ListFooterComponent={
        hasMore ? (
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
          >
            Tải thêm cuộc trò chuyện
          </Button>
        ) : null
      }
      renderItem={({ item }) => (
        <ConversationRow item={item} compact topic={title} />
      )}
    />
  );
}
function Separator() {
  return <View style={{ height: 10 }} />;
}
const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
