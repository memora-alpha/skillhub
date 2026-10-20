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
import { useChatOutbox } from "../context/ChatOutbox";
import { useChatEvents } from "../context/ChatEvents";
import { ChatComposer } from "../components/ChatComposer";
import { ChatHeader } from "../components/ChatHeader";
import type { ApiMessage } from "../api/messages-api";
import { chatTimeline } from "../utils/chat-timeline";
import { groupChatDays, type DatedChatItem } from "../utils/chat-dates";
import { ChatTimelineRow } from "../components/ChatTimelineRow";
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
    sender = useChatOutbox(id),
    live = useChatEvents();
  const partnerId =
    conversation.participantAId === runtime.userId
      ? conversation.participantBId
      : conversation.participantAId;
  const partner = useParticipantName(partnerId);
  const [draft, setDraft] = useState(""),
    [focused, setFocused] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const draftRef = useRef("");
  const updateDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };
  const [readError, setReadError] = useState<unknown>();
  const [visible, setVisible] = useState<ApiMessage>();
  const readWatermark = useRef<string | undefined>(undefined);
  const viewability = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<DatedChatItem>[] }) => {
      const viewed = viewableItems
        .filter((item) => item.isViewable)
        .flatMap((item) =>
          item.item.kind === "message" ? [item.item.message] : [],
        );
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
  const list = useRef<FlatList<DatedChatItem>>(null);
  const scrollOnSend = useRef(false);
  const lastScrollY = useRef(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const messages = thread.data?.messages ?? [];
  const timeline = groupChatDays(chatTimeline(messages, sender.items));
  useEffect(() => {
    sender.reconcile(messages.map((message) => message.id));
  }, [messages, sender.reconcile]);
  const last = visible;
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
  const agreement = () =>
    router.push({
      pathname: "/agreement-type",
      params: { conversationId: id, mode: "api" },
    });
  const send = (text: string) => {
    if (!text.trim() || text !== draftRef.current) return;
    scrollOnSend.current = true;
    if (sender.send(text)) {
      updateDraft("");
    } else scrollOnSend.current = false;
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
          onDetails={() => setShowDetails((value) => !value)}
          detailsExpanded={showDetails}
        />
        {showDetails && (
          <View
            style={{
              padding: 12,
              gap: 8,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/proposal/[id]",
                    params: { id: conversation.proposalId },
                  })
                }
              >
                Xem đề xuất
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/agreement-type",
                    params: { conversationId: id, mode: "api", draft: "1" },
                  })
                }
              >
                Gợi ý cách học
              </Button>
            </View>
            <Copy muted>
              Nội dung, lịch và Credit được xác nhận trong Lộ trình.
            </Copy>
          </View>
        )}
        <FlatList
          ref={list}
          data={timeline}
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
          scrollEventThrottle={16}
          onScroll={({ nativeEvent: { contentOffset } }) => {
            if (contentOffset.y < lastScrollY.current - 4)
              scrollOnSend.current = false;
            lastScrollY.current = contentOffset.y;
          }}
          onScrollBeginDrag={() => {
            scrollOnSend.current = false;
          }}
          refreshing={thread.isFetching}
          onRefresh={() => {
            refreshConversation();
            void thread.refetch();
          }}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
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
                error={
                  sender.offline
                    ? undefined
                    : (thread.error ?? thread.olderError)
                }
                retry={thread.refetch}
              />
              {!sender.offline && (
                <ConnectionFeedback error={live.error} retry={live.retry} />
              )}
            </View>
          }
          ListEmptyComponent={
            !thread.isPending && !thread.error ? (
              <Copy muted>Gửi lời chào để bắt đầu.</Copy>
            ) : null
          }
          renderItem={({ item }) => (
            <ChatTimelineRow
              item={item}
              partner={partner.data ?? "Thành viên SkillHub"}
              partnerId={partnerId}
              offline={sender.offline}
              retry={sender.retry}
            />
          )}
          onContentSizeChange={(_width, height) => {
            if (scrollOnSend.current) {
              // FlatList measures rows in multiple passes. Follow the new
              // message through those passes until the user scrolls away.
              requestAnimationFrame(() => {
                if (scrollOnSend.current)
                  list.current?.scrollToOffset({
                    offset: height,
                    animated: false,
                  });
              });
            }
          }}
        />
        <View style={{ paddingHorizontal: 12, gap: 8 }}>
          <ConnectionFeedback
            error={sender.error ?? (sender.offline ? undefined : readError)}
            retry={
              sender.error
                ? () => {
                    void sender.store.start();
                  }
                : undefined
            }
          />
          {!!readError && !sender.offline && (
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
          {sender.offline && (
            <Copy muted>Đang ngoại tuyến · Tin nhắn sẽ gửi khi có mạng.</Copy>
          )}
        </View>
        <ChatComposer
          value={draft}
          onChange={updateDraft}
          onSend={(text) => {
            void send(text);
          }}
          pending={!sender.ready}
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
