import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAgreementNavigation } from "@/features/learning-paths/state";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage, Copy } from "@/components/feature-page";
import {
  ConnectionFeedback,
  useConnections,
  useParticipantProfile,
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
import { lastSeenOutgoingId } from "../utils/seen-message";
import { messageGrouping } from "../utils/message-grouping";
import type { ApiMessage } from "../api/messages-api";
import { messageColors as colors } from "../constants/theme";
import { useConversationContext } from "../hooks/use-conversation-context";
import { ConfirmedFormFeedback } from "../components/ConfirmedFormFeedback";
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
  const partner = useParticipantProfile(partnerId);
  const context = useConversationContext(conversation, true);
  const agreement = useAgreementNavigation(id);
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
  const atLatest = useRef(true),
    hasScrolled = useRef(false);
  const previousLatest = useRef<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      atLatest.current = true;
      hasScrolled.current = false;
      setHasNewMessages(false);
      list.current?.scrollToOffset({ offset: 0, animated: false });
      return () => setFocused(false);
    }, []),
  );
  const messages = useMemo(
    () => [...(thread.data?.messages ?? [])].reverse(),
    [thread.data?.messages],
  );
  const seenMessageId = useMemo(
    () => lastSeenOutgoingId(messages, runtime.userId),
    [messages, runtime.userId],
  );
  useEffect(() => {
    const latest = messages[0]?.id;
    if (
      latest &&
      previousLatest.current &&
      latest !== previousLatest.current &&
      !atLatest.current
    )
      setHasNewMessages(true);
    previousLatest.current = latest;
  }, [messages]);
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
  const send = async (text: string) => {
    if (!text.trim() || sender.pending || sender.processing) return;
    if (await sender.send(text)) {
      setDraft("");
      atLatest.current = true;
      setHasNewMessages(false);
      list.current?.scrollToOffset({ offset: 0, animated: true });
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
            name: partner.data?.fullName ?? "Thành viên SkillHub",
            userId: partnerId,
            skill: "",
            request: "",
          }}
          onBack={() => router.dismissTo("/messages")}
          onAgreement={() => {
            void agreement.open();
          }}
          agreementPending={agreement.pending}
          topic={context.label}
          reference={context.reference}
          live={live.connected}
          avatarUrl={partner.data?.avatarUrl}
        />
        <FlatList
          ref={list}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 60,
          }}
          style={{ flex: 1, backgroundColor: colors.canvas }}
          onViewableItemsChanged={viewability.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          contentContainerStyle={{
            maxWidth: 640,
            width: "100%",
            alignSelf: "center",
            padding: 12,
          }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            hasScrolled.current = true;
          }}
          onScroll={({ nativeEvent }) => {
            const offset = nativeEvent.contentOffset.y;
            atLatest.current = offset < 60;
            if (offset > 20) hasScrolled.current = true;
            if (atLatest.current) setHasNewMessages(false);
          }}
          scrollEventThrottle={32}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (hasScrolled.current && focused && !thread.error)
              void thread.loadOlder();
          }}
          ListFooterComponent={
            <View style={{ gap: 10 }}>
              {thread.data?.nextCursor && !!thread.olderError && (
                <Button
                  variant="secondary"
                  disabled={thread.olderPending || thread.isFetching}
                  onPress={() => {
                    void thread.loadOlder();
                  }}
                >
                  Thử tải tin nhắn cũ
                </Button>
              )}
              <ConnectionFeedback
                loading={thread.isLoading || thread.olderPending}
                error={thread.error ?? thread.olderError}
                retry={() => {
                  refreshConversation();
                  void context.refetch();
                  if (thread.olderError) void thread.loadOlder();
                  else void thread.refetch();
                }}
              />
              <ConnectionFeedback error={live.error} retry={live.retry} />
            </View>
          }
          ListEmptyComponent={
            !thread.isPending && !thread.error ? (
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <Copy muted>Bạn có thể bắt đầu trò chuyện tại đây.</Copy>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const group = messageGrouping(
              item,
              messages[index + 1],
              messages[index - 1],
            );
            const date = new Date(item.sentAt);
            return (
              <View style={{ gap: 8, paddingTop: group.startsGroup ? 12 : 3 }}>
                {!!group.timestamp && (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Copy muted>
                      {group.timestamp === "day"
                        ? `${date.toLocaleDateString("vi-VN", {
                            weekday: "long",
                            day: "numeric",
                            month: "numeric",
                          })} · `
                        : ""}
                      {date.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Copy>
                  </View>
                )}
                <ApiMessageBubble
                  message={item}
                  partner={partner.data?.fullName ?? "Thành viên SkillHub"}
                  partnerId={partnerId}
                  avatarUrl={partner.data?.avatarUrl}
                  showReadReceipt={item.id === seenMessageId}
                  showAvatar={group.showAvatar}
                />
              </View>
            );
          }}
          onContentSizeChange={() => {
            if (messages.length > 0 && atLatest.current) {
              list.current?.scrollToOffset({ offset: 0, animated: false });
            }
          }}
        />
        {hasNewMessages && (
          <View style={{ alignItems: "center", padding: 6 }}>
            <Button
              variant="secondary"
              onPress={() => {
                atLatest.current = true;
                setHasNewMessages(false);
                list.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            >
              Tin nhắn mới ↓
            </Button>
          </View>
        )}
        <View style={{ paddingHorizontal: 12, gap: 8 }}>
          <ConfirmedFormFeedback conversationId={id} />
          <ConnectionFeedback error={agreement.error} retry={agreement.open} />
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
