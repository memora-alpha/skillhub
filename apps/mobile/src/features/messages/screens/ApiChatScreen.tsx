import { useCallback, useEffect, useRef, useState } from "react";
import { uuid } from "@/lib/http/contracts";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage, Copy } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantName,
} from "@/features/connections";
import {
  useConversation,
  useThread,
  useMessagesApi,
} from "../hooks/use-messages-api";
import { useMessageSend } from "../hooks/use-message-send";
import { useChatEvents } from "../context/ChatEvents";
import { ChatComposer } from "../components/ChatComposer";
import { ChatHeader } from "../components/ChatHeader";
import { ApiMessageBubble } from "../components/ApiMessageBubble";
import type { ApiMessage } from "../api/messages-api";
import { messageColors as colors } from "../constants/theme";

export function ApiChatScreen({ id }: Readonly<{ id: string }>) {
  const conversation = useConversation(id);
  if (!uuid.safeParse(id).success)
    return (
      <FeaturePage title="Tin nhắn" demo={false} back="/messages">
        <EmptyState
          title="Không tìm thấy cuộc trao đổi"
          description="Đường dẫn cuộc trao đổi không hợp lệ."
        />
      </FeaturePage>
    );
  if (!conversation.data)
    return (
      <FeaturePage title="Tin nhắn" demo={false} back="/messages">
        <ConnectionFeedback
          loading={conversation.isLoading}
          error={conversation.error}
          retry={conversation.refetch}
        />
        {!conversation.isPending && !conversation.error && (
          <EmptyState
            title="Không tìm thấy cuộc trao đổi"
            description="Kiểm tra lại cuộc trao đổi của bạn."
          />
        )}
      </FeaturePage>
    );
  return (
    <ApiChatConversation
      key={id}
      id={id}
      conversation={conversation.data}
      refreshConversation={conversation.refetch}
    />
  );
}
function ApiChatConversation({
  id,
  conversation,
  refreshConversation,
}: Readonly<{
  id: string;
  conversation: NonNullable<ReturnType<typeof useConversation>["data"]>;
  refreshConversation: () => unknown;
}>) {
  const router = useRouter(),
    runtime = useConnections(),
    api = useMessagesApi();
  const thread = useThread(id, true),
    sender = useMessageSend(id),
    live = useChatEvents();
  const partnerId =
    conversation.participantAId === runtime.userId
      ? conversation.participantBId
      : conversation.participantAId;
  const partner = useParticipantName(partnerId);
  const [draft, setDraft] = useState(""),
    [focused, setFocused] = useState(false);
  const [readError, setReadError] = useState<unknown>();
  const [visible, setVisible] = useState<ApiMessage>();
  const readWatermark = useRef<string | undefined>(undefined);
  const viewability = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<ApiMessage>[] }) => {
      const viewed = viewableItems
        .filter((item) => item.isViewable)
        .map((item) => item.item);
      viewed.sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1));
      const lastViewed = viewed.at(-1);
      if (lastViewed)
        setVisible((previous) =>
          !previous || BigInt(previous.sequence) < BigInt(lastViewed.sequence)
            ? lastViewed
            : previous,
        );
    },
  );
  const list = useRef<FlatList<ApiMessage>>(null);
  const scrollOnSend = useRef(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const messages = thread.data?.messages ?? [];
  const last = visible;
  useEffect(() => {
    if (!focused || !last || thread.error || readWatermark.current === last.id)
      return;
    let current = true;
    const target = last.id;
    void api
      .read(id, target)
      .then(() => {
        if (current && runtime.isCurrent()) {
          readWatermark.current = target;
          setReadError(undefined);
        }
      })
      .catch((error) => {
        if (current && runtime.isCurrent()) setReadError(error);
      });
    return () => {
      current = false;
    };
  }, [last?.id, focused, thread.error, api, id, runtime]);
  const agreement = () =>
    router.push({
      pathname: "/agreement-type",
      params: { conversationId: id, mode: "api" },
    });
  const send = async (text: string) => {
    if (!text.trim() || sender.pending || sender.processing) return;
    if (await sender.send(text)) {
      setDraft("");
      scrollOnSend.current = true;
      void thread.refetch();
    }
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface }}
      edges={["top", "bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ChatHeader
          conversation={{
            proposal: id,
            name: partner.data ?? "Thành viên SkillHub",
            userId: partnerId,
            skill: "",
            request: "",
            last: "",
            messages: 0,
            unread: 0,
            time: "",
          }}
          onBack={() => router.dismissTo("/messages")}
          onAgreement={agreement}
          live={live.connected}
        />
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: colors.canvas }}
          onViewableItemsChanged={viewability.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          contentContainerStyle={{
            maxWidth: 640,
            width: "100%",
            alignSelf: "center",
            padding: 12,
            gap: 10,
          }}
          keyboardShouldPersistTaps="handled"
          refreshing={thread.isFetching}
          onRefresh={() => {
            refreshConversation();
            void thread.refetch();
          }}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              <Copy muted>
                Chat để thương lượng; xác nhận kế hoạch và lịch học cần thao tác
                riêng.
              </Copy>
              <Button
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/proposal/[id]",
                    params: { id: conversation.proposalId },
                  })
                }
              >
                Xem đề xuất gốc
              </Button>
              <Button variant="craft" onPress={agreement}>
                Lộ trình học
              </Button>
              {thread.data?.nextCursor && (
                <Button
                  variant="secondary"
                  disabled={thread.olderPending || thread.isFetching}
                  onPress={() => {
                    void thread.loadOlder();
                  }}
                >
                  Tin nhắn trước đó
                </Button>
              )}
              <ConnectionFeedback
                loading={thread.isLoading}
                error={thread.error ?? thread.olderError}
                retry={thread.refetch}
              />
              <ConnectionFeedback error={live.error} retry={live.retry} />
            </View>
          }
          ListEmptyComponent={
            !thread.isPending && !thread.error ? (
              <Copy muted>Bắt đầu trao đổi về mục tiêu và cách học.</Copy>
            ) : null
          }
          renderItem={({ item }) => (
            <ApiMessageBubble
              message={item}
              partner={partner.data ?? "Thành viên SkillHub"}
              partnerId={partnerId}
            />
          )}
          onContentSizeChange={() => {
            if (scrollOnSend.current) {
              scrollOnSend.current = false;
              list.current?.scrollToEnd({ animated: false });
            }
          }}
        />
        <View style={{ paddingHorizontal: 12, gap: 8 }}>
          <ConnectionFeedback
            error={sender.error ?? sender.delivery.error ?? readError}
          />
          {!!readError && (
            <Button
              variant="secondary"
              onPress={() => {
                if (last)
                  void api
                    .read(id, last.id)
                    .then(() => setReadError(undefined))
                    .catch(setReadError);
              }}
            >
              Thử xác nhận đã đọc
            </Button>
          )}
          {sender.processing && (
            <>
              <Copy muted>Tin nhắn đang được xử lý, chưa xác nhận đã gửi.</Copy>
              <Button
                variant="secondary"
                disabled={sender.delivery.isFetching}
                onPress={() => {
                  void sender.delivery.refetch();
                }}
              >
                Kiểm tra trạng thái gửi
              </Button>
              {sender.delivery.data?.deliveryStatus !== "DELIVERED" &&
                sender.delivery.data?.failureCode && (
                  <Button
                    variant="secondary"
                    disabled={sender.pending}
                    onPress={() => {
                      void sender.retryPublication();
                    }}
                  >
                    Thử gửi lại tin đang xử lý
                  </Button>
                )}
            </>
          )}
        </View>
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={(text) => {
            void send(text);
          }}
          pending={sender.pending || sender.processing}
          onAttach={() =>
            router.push({
              pathname: "/chat-attachment",
              params: { proposalId: id, mode: "api" },
            })
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
