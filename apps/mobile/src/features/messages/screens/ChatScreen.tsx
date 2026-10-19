import { useEffect, useRef, useState } from "react";
import { uuid } from "@/lib/http/contracts";
import { ApiChatScreen } from "./ApiChatScreen";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { avatarSizes, typography, fonts } from "@/constants/theme";
import { useAuthSession } from "@/features/auth";
import { useMockMessages } from "../context/MockMessages";
import type { Conversation } from "../mocks/conversations";
import type { ChatMessage } from "../mocks/chat";
import { ChatHeader } from "../components/ChatHeader";
import { ChatComposer } from "../components/ChatComposer";
import { MessageBubble } from "../components/MessageBubble";
import {
  AcceptedProposalNotice,
  ChatNextStep,
} from "../components/ChatActionCards";
import { messageColors as colors } from "../constants/theme";

const typingDotIds = ["typing-dot-1", "typing-dot-2", "typing-dot-3"] as const;

function ChatMessageSeparator() {
  return <View style={styles.separator} />;
}

export function ChatScreen() {
  const params = useLocalSearchParams<{
    proposalId?: string | string[];
    mode?: string;
  }>();
  const id = Array.isArray(params.proposalId)
    ? params.proposalId[0]
    : params.proposalId;
  if (id && (params.mode === "api" || uuid.safeParse(id).success))
    return <ApiChatScreen id={id} />;
  return <PreviewChatScreen />;
}
function PreviewChatScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const { conversations } = useMockMessages();
  const params = useLocalSearchParams<{ proposalId?: string | string[] }>();
  const id = Array.isArray(params.proposalId)
    ? params.proposalId[0]
    : params.proposalId;
  const conversation = conversations.find((item) => item.proposal === id);
  if (!session) return <Redirect href="/login" />;
  if (!conversation)
    return (
      <AppScreenLayout
        title="Tin nhắn"
        selected="Tin nhắn"
        back={{ href: "/messages", label: "Quay lại tin nhắn" }}
      >
        {() => (
          <EmptyState
            icon="message"
            title="Không tìm thấy cuộc trao đổi"
            description="Cuộc trao đổi này không có trong dữ liệu demo."
            action="Quay lại tin nhắn"
            onAction={() => router.dismissTo("/messages")}
          />
        )}
      </AppScreenLayout>
    );
  return (
    <ChatConversation key={conversation.proposal} conversation={conversation} />
  );
}
function ChatConversation({
  conversation,
}: Readonly<{ conversation: Conversation }>) {
  const router = useRouter();
  const { threads, markRead, send } = useMockMessages();
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList<ChatMessage>>(null);
  const scrollOnSend = useRef(false);
  const messages = threads[conversation.proposal] ?? [];
  useEffect(() => {
    markRead(conversation.proposal);
  }, [conversation.proposal, markRead]);
  const submit = (text: string) => {
    if (!text.trim()) return;
    scrollOnSend.current = true;
    send(conversation.proposal, text);
    setDraft("");
  };
  const agreement = () =>
    router.push({
      pathname: "/agreement-type",
      params: { proposalId: conversation.proposal },
    });
  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ChatHeader
          conversation={conversation}
          onBack={() => router.dismissTo("/messages")}
          onAgreement={agreement}
        />
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={ChatMessageSeparator}
          ListHeaderComponent={
            <View style={styles.heading}>
              <Text style={styles.date}>
                {messages.length
                  ? `Hôm nay, ${messages[0]?.time}`
                  : "Bắt đầu cuộc trao đổi"}
              </Text>
              <AcceptedProposalNotice />
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              partner={conversation.name}
              partnerId={conversation.userId}
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <ChatNextStep onPress={agreement} />
              <View
                style={styles.typingRow}
                accessibilityLabel="Trạng thái đang nhập mẫu"
              >
                <Avatar
                  name={conversation.name}
                  userId={conversation.userId}
                  size={avatarSizes.inline}
                />
                <View style={styles.typing}>
                  {typingDotIds.map((id) => (
                    <View key={id} style={styles.dot} />
                  ))}
                </View>
              </View>
            </View>
          }
          onContentSizeChange={() => {
            if (scrollOnSend.current) {
              scrollOnSend.current = false;
              list.current?.scrollToEnd({ animated: false });
            }
          }}
        />
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={submit}
          onAttach={() =>
            router.push({
              pathname: "/chat-attachment",
              params: { proposalId: conversation.proposal },
            })
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  keyboard: { flex: 1 },
  list: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  heading: { gap: 8, marginBottom: 8 },
  date: {
    textAlign: "center",
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.mutedLight,
    paddingVertical: 2,
  },
  footer: { gap: 8, marginTop: 10 },
  separator: { height: 8 },
  typingRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  typing: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    minHeight: 24,
    boxShadow: "0 2px 6px rgba(53, 43, 31, 0.04)",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mutedLight,
  },
});
