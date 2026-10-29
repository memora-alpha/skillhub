import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uuid } from "@/lib/http/contracts";
import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { FlatListProps } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
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
import { useChatOutbox } from "../context/ChatOutbox";
import { useChatEvents } from "../context/ChatEvents";
import { ChatComposer } from "../components/ChatComposer";
import { ChatHeader } from "../components/ChatHeader";
import { ChatThreadMessage } from "../components/ChatThreadMessage";
import { chatTimeline, type ChatTimelineItem } from "../utils/chat-timeline";
import { lastSeenOutgoingId } from "../utils/seen-message";
import type { ApiMessage } from "../api/messages-api";
import { messageColors as colors } from "../constants/theme";
import { useConversationContext } from "../hooks/use-conversation-context";
import { ConfirmedFormFeedback } from "../components/ConfirmedFormFeedback";
import { useChatAttachment } from "../hooks/use-chat-attachment";
import { ChatAttachmentPreview } from "../components/ChatAttachmentPreview";
import { ChatSendFeedback } from "../components/ChatSendFeedback";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";
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
    sender = useChatOutbox(id),
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
  const attachment = useChatAttachment(id);
  const draftRef = useRef("");
  const sending = useRef(false);
  const updateDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };
  const [readError, setReadError] = useState<unknown>();
  const [last, setLast] = useState<ApiMessage>();
  const readWatermark = useRef<string | undefined>(undefined);
  const viewability = useRef<
    NonNullable<FlatListProps<ChatTimelineItem>["onViewableItemsChanged"]>
  >(({ viewableItems }) => {
    const viewed = viewableItems
      .filter((item) => item.isViewable)
      .flatMap(({ item }) => (item.kind === "message" ? [item.message] : []));
    viewed.sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1));
    const lastViewed = viewed.at(-1);
    if (lastViewed)
      setLast((previous) =>
        !previous || BigInt(previous.sequence) < BigInt(lastViewed.sequence)
          ? lastViewed
          : previous,
      );
  });
  const list = useRef<FlatList<ChatTimelineItem>>(null);
  const atLatest = useRef(true),
    hasScrolled = useRef(false);
  const previousLatest = useRef<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const deliveryKeys = useRef(new Map<string, string>());
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
  const timeline = useMemo(
    () =>
      chatTimeline(
        thread.data?.messages ?? [],
        sender.items,
        deliveryKeys.current,
      ).reverse(),
    [thread.data?.messages, sender.items],
  );
  const messages = timeline.flatMap((item) =>
    item.kind === "message" ? [item.message] : [],
  );
  useEffect(() => {
    sender.reconcile(
      (thread.data?.messages ?? []).map((message) => message.id),
    );
  }, [thread.data?.messages, sender.reconcile]);
  const seenMessageId = lastSeenOutgoingId(messages, runtime.userId);
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
  useEffect(() => {
    if (
      sender.offline ||
      !focused ||
      !last ||
      thread.error ||
      readWatermark.current === last.id
    )
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
  }, [last?.id, focused, thread.error, api, id, runtime, sender.offline]);
  const send = async (text: string) => {
    if (
      sending.current ||
      draftRef.current !== text ||
      (!text.trim() && !attachment.file) ||
      !sender.ready
    )
      return;
    sending.current = true;
    try {
      if (
        attachment.file ? await attachment.send(text) : await sender.send(text)
      ) {
        if (draftRef.current === text) updateDraft("");
        atLatest.current = true;
        setHasNewMessages(false);
        list.current?.scrollToOffset({ offset: 0, animated: true });
      }
    } finally {
      sending.current = false;
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
        <ScreenLoadingBoundary>
          <FlatList
            ref={list}
            data={timeline}
            inverted={timeline.length > 0}
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
                  loadingPresentation={
                    thread.isLoading ? "screen" : "placeholder"
                  }
                  error={
                    sender.offline
                      ? undefined
                      : (thread.error ?? thread.olderError)
                  }
                  retry={() => {
                    refreshConversation();
                    void context.refetch();
                    if (thread.olderError) void thread.loadOlder();
                    else void thread.refetch();
                  }}
                />
                {!sender.offline && (
                  <ConnectionFeedback error={live.error} retry={live.retry} />
                )}
              </View>
            }
            ListEmptyComponent={
              !thread.isPending && !thread.error ? (
                <View>
                  <Copy muted>Bạn có thể bắt đầu trò chuyện tại đây.</Copy>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <ChatThreadMessage
                item={item}
                older={timeline[index + 1]}
                newer={timeline[index - 1]}
                userId={runtime.userId ?? ""}
                offline={sender.offline}
                retry={sender.retry}
                partner={partner.data?.fullName ?? "Thành viên SkillHub"}
                partnerId={partnerId}
                avatarUrl={partner.data?.avatarUrl}
                seen={
                  item.kind === "message" && item.message.id === seenMessageId
                }
              />
            )}
            onContentSizeChange={() => {
              if (timeline.length > 0 && atLatest.current) {
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }
            }}
          />
        </ScreenLoadingBoundary>
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
          <ChatSendFeedback
            id={id}
            messageId={last?.id}
            sender={sender}
            readError={readError}
            onReadError={setReadError}
          />
        </View>
        <ChatComposer
          attachmentPreview={
            <ChatAttachmentPreview
              inComposer
              attachment={attachment}
              onRecovered={(text) => {
                if (draftRef.current === text && runtime.isCurrent())
                  updateDraft("");
              }}
            />
          }
          value={draft}
          onChange={updateDraft}
          onSend={(text) => {
            void send(text);
          }}
          pending={
            !sender.ready || attachment.uncertain || attachment.processing
          }
          hasAttachment={!!attachment.file}
          sendDisabled={
            attachment.pending || (!!attachment.file && !attachment.ready)
          }
          attachmentDisabled={attachment.locked}
          onAttach={() => {
            void attachment.choose();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
