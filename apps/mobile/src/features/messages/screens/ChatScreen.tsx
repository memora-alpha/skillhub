import { useEffect, useRef, useState } from "react";
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
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { InfoModal } from "@/components/InfoModal";
import { avatarSizes, typography, fonts } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";
import { useMockMessages } from "../context/MockMessages";
import { conversations, type Conversation } from "../mocks/conversations";
import type { ChatMessage } from "../mocks/chat";
import { ChatHeader } from "../components/ChatHeader";
import { ChatComposer } from "../components/ChatComposer";
import { MessageBubble } from "../components/MessageBubble";
import {
  AcceptedProposalNotice,
  ChatNextStep,
} from "../components/ChatActionCards";
import { messageColors as colors } from "../constants/theme";

export function ChatScreen() {
  const router = useRouter();
  const { session } = useMockSession();
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
function ChatConversation({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const { threads, markRead, send } = useMockMessages();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<"agreement" | "file" | null>(null);
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
          onAgreement={() => setNotice("agreement")}
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
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={styles.heading}>
              <Text style={styles.date}>Hôm nay, {messages[0]?.time}</Text>
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
              <ChatNextStep onPress={() => setNotice("agreement")} />
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
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={styles.dot} />
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
          onAttach={() => setNotice("file")}
        />
      </KeyboardAvoidingView>
      <InfoModal
        title={
          notice === "agreement"
            ? "Chọn hình thức học"
            : notice === "file"
              ? "Đính kèm tệp"
              : null
        }
        onClose={() => setNotice(null)}
      >
        {notice === "agreement"
          ? "Màn chọn hình thức học sẽ được triển khai tiếp theo. Tin nhắn demo không tạo thỏa thuận, khóa lịch hoặc tạm giữ Credit."
          : "Màn gửi tệp sẽ được triển khai tiếp theo. Hiện tại bản demo chỉ hỗ trợ gửi tin nhắn văn bản local, không tải tệp lên máy chủ."}
      </InfoModal>
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
