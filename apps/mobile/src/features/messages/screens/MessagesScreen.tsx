import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ApiMessagesScreen } from "./ApiMessagesScreen";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppScreenLayout } from "@/features/shell";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { iconSizes, typography, fonts } from "@/constants/theme";
import { ConversationCard } from "../components/ConversationCard";
import { useMockMessages } from "../context/MockMessages";
import { initialThreads } from "../mocks/chat";
import { messageColors as colors } from "../constants/theme";

function ConversationSeparator() {
  return <View style={styles.separator} />;
}

export function MessagesScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === "preview" ? <PreviewMessagesScreen /> : <ApiMessagesScreen />;
}
function PreviewMessagesScreen() {
  const router = useRouter();
  const { threads, read, conversations } = useMockMessages();
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
    <AppScreenLayout
      title="Tin nhắn"
      selected="Tin nhắn"
      contentStyle={styles.background}
    >
      {() => (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.proposal}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.list}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={ConversationSeparator}
          ListHeaderComponent={
            <View>
              {/* Proposal banner */}
              <Pressable
                style={styles.banner}
                accessibilityRole="button"
                accessibilityLabel="Xem các proposal hiện có"
                onPress={() => router.push("/proposals")}
              >
                <View style={styles.bannerIcon}>
                  <Icon
                    name="clipboard"
                    size={iconSizes.control}
                    color={colors.orange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Các proposal hiện có</Text>
                  <Text style={styles.bannerSub}>
                    Đang chờ duyệt hoặc phản hồi
                  </Text>
                </View>
                <View style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>Xem</Text>
                  <Icon
                    name="chevron"
                    size={iconSizes.inline}
                    color={colors.orange}
                  />
                </View>
              </Pressable>

              {/* Search bar */}
              <View
                style={[
                  styles.search,
                  focused && { borderColor: colors.orange },
                ]}
              >
                <Icon
                  name="search"
                  color={colors.muted}
                  size={iconSizes.control}
                />
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
                    <Icon
                      name="close"
                      size={iconSizes.control}
                      color={colors.muted}
                    />
                  </Pressable>
                )}
              </View>

              {/* Section header */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {"CÁC PROPOSAL ĐÃ CHẤP NHẬN  "}
                  <Text style={styles.sectionCount}>{filtered.length}</Text>
                </Text>
                <Text style={styles.sectionRight}>Đang trao đổi</Text>
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
        />
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  list: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingBottom: 24,
  },
  separator: { height: 8 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: colors.orangePale,
    borderWidth: 1,
    borderColor: "#FFE6D9",
    borderRadius: 9,
  },
  bannerTitle: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
  },
  bannerSub: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: colors.orangeSoft,
  },
  bannerBtnText: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.orange,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeSoft,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 2,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    fontFamily: fonts.body,
    color: colors.ink,
    ...typography.secondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    ...typography.caption,
    letterSpacing: 0,
    color: colors.muted,
  },
  sectionCount: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.orange,
  },
  sectionRight: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
});
