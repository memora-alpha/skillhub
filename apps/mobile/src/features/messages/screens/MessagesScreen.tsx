import { useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { colors, fonts, radius } from "@/constants/theme";
import { ConversationCard } from "../components/ConversationCard";
import { useMockMessages } from "../context/MockMessages";
import { initialThreads } from "../mocks/chat";
import { conversations, conversationHint } from "../mocks/conversations";

export function MessagesScreen() {
  const router = useRouter();
  const { threads, read } = useMockMessages();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const normalized = query.trim().toLocaleLowerCase("vi");
  const previews = conversations.map((item) => {
    const thread = threads[item.proposal] ?? [];
    const added = thread.length - (initialThreads[item.proposal]?.length ?? 0);
    const latest = thread[thread.length - 1];
    return added > 0 && latest
      ? {
          ...item,
          last: latest.text,
          time: latest.time,
          messages: item.messages + added,
        }
      : item;
  });
  const filtered = previews.filter((item) =>
    `${item.name} ${item.skill} ${item.request} ${item.proposal}`
      .toLocaleLowerCase("vi")
      .includes(normalized),
  );
  return (
    <AppScreenLayout title="Tin nhắn" selected="Tin nhắn">
      {(open) => (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.proposal}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={styles.list}
            contentContainerStyle={styles.content}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListHeaderComponent={
              <View style={styles.heading}>
                <View style={{ gap: 4 }}>
                  <Text accessibilityRole="header" style={styles.title}>
                    Các cuộc trao đổi đã mở
                  </Text>
                  <Text style={styles.subtitle}>
                    Chỉ Proposal đã được chấp nhận mới xuất hiện tại đây.
                  </Text>
                </View>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => open("Proposal")}
                >
                  Xem Proposal
                </Button>
                <View
                  style={[
                    styles.search,
                    focused && { borderColor: colors.brand },
                  ]}
                >
                  <Icon name="search" color={colors.muted} size={16} />
                  <TextInput
                    accessibilityLabel="Tìm cuộc trao đổi"
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Tìm theo người, kỹ năng hoặc bài đăng..."
                    placeholderTextColor={colors.mutedLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={styles.input}
                  />
                  {!!query && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa tìm kiếm"
                      onPress={() => setQuery("")}
                      hitSlop={8}
                    >
                      <Icon name="close" size={16} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <ConversationCard
                conversation={item}
                unread={read.includes(item.proposal) ? 0 : item.unread}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[proposalId]",
                    params: { proposalId: item.proposal },
                  })
                }
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="message"
                title="Không tìm thấy cuộc trao đổi"
                description="Thử tên người, kỹ năng hoặc nội dung bài đăng khác."
                action="Xóa tìm kiếm"
                onAction={() => setQuery("")}
              />
            }
            ListFooterComponent={
              <View style={styles.hint}>
                <Icon name="alert" size={16} color="#1E40AF" />
                <Text style={styles.hintText}>{conversationHint}</Text>
              </View>
            }
          />
        </>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 896,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  heading: { gap: 20, marginBottom: 20 },
  title: {
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    borderRadius: radius.card,
    marginTop: 20,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22.75,
    color: "#1E40AF",
  },
});
