import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ConversationCard } from "../components/ConversationCard";
import { InboxHeader } from "../components/InboxHeader";
import { messageColors as colors } from "../constants/theme";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
  useParticipantProfile,
} from "@/features/connections";
import { useConversations, useMessagesApi } from "../hooks/use-messages-api";
import {
  readPlanShare,
  readConfirmedForm,
  confirmedFormLabels,
} from "@/features/learning-paths/policy";
import type { ApiConversation } from "../api/messages-api";
import { useConversationContext } from "../hooks/use-conversation-context";
import { hasUnreadIncoming } from "../utils/inbox-unread";
import { useInboxOrder } from "../hooks/use-inbox-order";

function ConversationRow({
  conversation,
}: Readonly<{ conversation: ApiConversation }>) {
  const router = useRouter(),
    { userId } = useConnections(),
    api = useMessagesApi();
  const partnerId =
    conversation.participantAId === userId
      ? conversation.participantBId
      : conversation.participantAId;
  const profile = useParticipantProfile(partnerId);
  const context = useConversationContext(conversation);
  const preview = useConnectionQuery(
    ["conversations", "preview", conversation.id],
    async (signal) => {
      const page = await api.history(conversation.id, { signal });
      return {
        message: page.items.at(-1) ?? null,
        unread: hasUnreadIncoming(page.items, userId),
      };
    },
  );
  const last = preview.data?.message;
  let snippet = "Bắt đầu trò chuyện";
  if (preview.isLoading) snippet = "Đang tải tin nhắn…";
  else if (preview.error) snippet = "Mở để xem tin nhắn";
  else if (last) {
    const form = readConfirmedForm(last.messageText);
    snippet = form
      ? `Đã xác nhận ${confirmedFormLabels[form.kind].toLowerCase()}`
      : readPlanShare(last.messageText)
        ? "Lộ trình học được chia sẻ"
        : last.messageText || "Đã gửi tệp đính kèm";
  }
  const time = new Date(last?.sentAt ?? conversation.createdAt);
  const timeLabel =
    time.toDateString() === new Date().toDateString()
      ? time.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : time.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" });
  return (
    <ConversationCard
      name={profile.data?.fullName ?? "Thành viên SkillHub"}
      avatarUrl={profile.data?.avatarUrl}
      userId={partnerId}
      preview={`${!preview.error && last?.senderId === userId ? "Bạn: " : ""}${snippet}`}
      time={timeLabel}
      topic={context.label}
      reference={context.reference}
      unread={
        !preview.error && !preview.isLoading && (preview.data?.unread ?? false)
      }
      onPress={() =>
        router.push({
          pathname: "/chat/[proposalId]",
          params: { proposalId: conversation.id, mode: "api" },
        })
      }
    />
  );
}
export function ApiMessagesScreen() {
  const query = useConversations(),
    router = useRouter();
  const ordered = useInboxOrder(query.items);
  return (
    <AppScreenLayout
      title="Tin nhắn"
      selected="Tin nhắn"
      contentStyle={styles.background}
    >
      {() => (
        <FlatList
          data={ordered}
          keyExtractor={(item) => item.id}
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
          renderItem={({ item }) => <ConversationRow conversation={item} />}
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
