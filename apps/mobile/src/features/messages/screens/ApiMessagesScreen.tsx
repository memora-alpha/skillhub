import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConnectionFeedback } from "@/features/connections";
import { useConversationInbox } from "../hooks/use-conversation-inbox";
import { ConversationRow } from "../components/ConversationRow";
import { messageColors as colors } from "../constants/theme";
function ConversationSeparator() {
  return <View style={styles.separator} />;
}

export function ApiMessagesScreen() {
  const query = useConversationInbox(),
    router = useRouter();
  return (
    <AppScreenLayout title="Tin nhắn" selected="Tin nhắn">
      {() => (
        <FlatList
          data={query.items}
          keyExtractor={(item) => item.conversation.id}
          contentContainerStyle={styles.content}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
          ItemSeparatorComponent={ConversationSeparator}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching)
              void query.fetchNextPage({ cancelRefetch: false });
          }}
          ListHeaderComponent={
            <View style={{ gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                style={{ alignSelf: "flex-end" }}
                onPress={() => router.push("/proposals")}
              >
                Đề xuất
              </Button>
              <ConnectionFeedback
                loading={query.isLoading}
                error={query.error}
                retry={query.refetch}
              />
            </View>
          }
          ListEmptyComponent={
            !query.isPending && !query.error ? (
              <EmptyState
                icon="message"
                title="Chưa có tin nhắn"
                description="Chấp nhận đề xuất để bắt đầu trao đổi."
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
const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: colors.border,
  },
});
