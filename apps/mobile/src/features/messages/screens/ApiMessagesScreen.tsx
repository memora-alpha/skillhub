import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { StyleSheet, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { useIsFocused, useRouter } from "expo-router";
import {
  isTransientReadError,
  useQuietReadRecovery,
} from "@/lib/query/use-quiet-read-recovery";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { InboxHeader } from "../components/InboxHeader";
import { ConversationRow } from "../components/ConversationRow";
import { useConversationInbox } from "../hooks/use-conversation-inbox";
import { messageColors as colors } from "../constants/theme";

export function ApiMessagesScreen() {
  const query = useConversationInbox(),
    router = useRouter();
  const focused = useIsFocused();
  const quietError = isTransientReadError(query.error);
  useQuietReadRecovery({
    error: query.error,
    fetching: query.isFetching,
    enabled: focused,
    retry: () =>
      query.isFetchNextPageError
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch(),
  });
  let footer = null;
  if (quietError && query.isFetchNextPageError)
    footer = <ActivityIndicator accessibilityLabel="Đang tải thêm hội thoại" />;
  else if (query.hasNextPage)
    footer = (
      <Button
        variant="secondary"
        disabled={query.isFetching}
        onPress={() => {
          void query.fetchNextPage({ cancelRefetch: false });
        }}
      >
        Xem thêm
      </Button>
    );
  return (
    <AppScreenLayout
      title="Tin nhắn"
      selected="Tin nhắn"
      contentStyle={styles.background}
    >
      {() => (
        <FlatList
          data={query.items}
          keyExtractor={(item) => item.conversation.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ConversationSeparator}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching)
              void query.fetchNextPage({ cancelRefetch: false });
          }}
          ListHeaderComponent={
            <InboxHeader onOpenProposals={() => router.push("/proposals")}>
              <ConnectionFeedback
                loading={!query.data && (query.isPending || quietError)}
                error={quietError ? undefined : query.error}
                retry={query.refetch}
              />
            </InboxHeader>
          }
          ListEmptyComponent={
            !query.isPending && (!query.error || (query.data && quietError)) ? (
              <EmptyState
                icon="message"
                title="Chưa có tin nhắn"
                description="Khi đề xuất được chấp nhận, bạn có thể bắt đầu trò chuyện tại đây."
                action="Xem đề xuất"
                onAction={() => router.push("/proposals")}
              />
            ) : null
          }
          ListFooterComponent={footer}
          renderItem={({ item }) => <ConversationRow item={item} />}
        />
      )}
    </AppScreenLayout>
  );
}

function ConversationSeparator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 24,
  },
  separator: { height: 10 },
});
