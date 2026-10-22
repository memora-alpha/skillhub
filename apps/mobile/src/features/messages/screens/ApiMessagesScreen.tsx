import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
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
                loading={query.isLoading}
                error={query.error}
                retry={query.refetch}
              />
            </InboxHeader>
          }
          ListEmptyComponent={
            !query.isPending && !query.error ? (
              <EmptyState
                icon="message"
                title="Chưa có tin nhắn"
                description="Khi đề xuất được chấp nhận, bạn có thể bắt đầu trò chuyện tại đây."
                action="Xem đề xuất"
                onAction={() => router.push("/proposals")}
              />
            ) : null
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                variant="secondary"
                disabled={query.isFetching}
                onPress={() => {
                  void query.fetchNextPage({ cancelRefetch: false });
                }}
              >
                Xem thêm
              </Button>
            ) : null
          }
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
