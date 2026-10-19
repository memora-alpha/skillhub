import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Panel, Copy, ui } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantName,
} from "@/features/connections";
import { useConversations } from "../hooks/use-messages-api";
import type { ApiConversation } from "../api/messages-api";
function ConversationSeparator() {
  return <View style={{ height: 12 }} />;
}

function ConversationRow({
  conversation,
}: Readonly<{ conversation: ApiConversation }>) {
  const router = useRouter(),
    { userId } = useConnections();
  const partnerId =
    conversation.participantAId === userId
      ? conversation.participantBId
      : conversation.participantAId;
  const name = useParticipantName(partnerId);
  return (
    <Panel title={name.data ?? "Thành viên SkillHub"}>
      <Copy>
        Đề xuất đã chấp nhận ·{" "}
        {new Date(conversation.createdAt).toLocaleDateString("vi-VN")}
      </Copy>
      <Button
        variant="craft"
        onPress={() =>
          router.push({
            pathname: "/chat/[proposalId]",
            params: { proposalId: conversation.id, mode: "api" },
          })
        }
      >
        Mở cuộc trao đổi
      </Button>
    </Panel>
  );
}
export function ApiMessagesScreen() {
  const query = useConversations(),
    router = useRouter();
  return (
    <AppScreenLayout title="Tin nhắn" selected="Tin nhắn">
      {() => (
        <FlatList
          data={query.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={ui.page}
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
            <View style={{ gap: 12, marginBottom: 16 }}>
              <Button
                variant="secondary"
                onPress={() => router.push("/proposals")}
              >
                Xem đề xuất đã nhận / đã gửi
              </Button>
              <Copy>Những đề xuất đã chấp nhận mở cuộc trao đổi tại đây.</Copy>
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
                title="Chưa có cuộc trao đổi"
                description="Chat xuất hiện sau khi đề xuất được chấp nhận."
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
                Tải thêm cuộc trao đổi
              </Button>
            ) : null
          }
          renderItem={({ item }) => <ConversationRow conversation={item} />}
        />
      )}
    </AppScreenLayout>
  );
}
