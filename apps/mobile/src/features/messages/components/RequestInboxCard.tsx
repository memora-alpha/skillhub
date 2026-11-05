import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import type { ApiInboxGroup } from "../api/messages-api";
import type { RequestInboxGroup } from "../utils/inbox-groups";
import { messageColors as colors } from "../constants/theme";
import { conversationReference } from "../api/conversation-context";

type RequestGroup = Extract<ApiInboxGroup, { groupType: "LEARNING_REQUEST" }>;

function requestSummary(group: RequestGroup) {
  const chats = `${group.conversationCount} đoạn chat`;
  if (group.viewerRole === "OWNER")
    return `${group.receivedProposalCount} đề xuất nhận được · ${chats}`;
  if (group.viewerRole === "PROPOSER") return `Đã gửi đề xuất · ${chats}`;
  return chats;
}

export function RequestInboxCard({
  group,
  previewGroup,
}: Readonly<{
  group: RequestGroup;
  previewGroup?: RequestInboxGroup;
}>) {
  const router = useRouter();
  const unread = previewGroup?.unread ?? false;
  const proposalId = previewGroup?.latestConversation?.conversation.proposalId;
  const summary = requestSummary(group);
  const title = group.title?.trim() || "Yêu cầu học";
  const reference = group.title?.trim()
    ? undefined
    : conversationReference(group.learningRequestId);
  const view = group.conversationCount ? "chats" : "received";
  const referenceLabel = reference ? `, ${reference}` : "";
  const unreadLabel = unread ? ", có tin nhắn chưa đọc" : "";
  const accessibilityLabel = `${title}${referenceLabel}, ${summary}${unreadLabel}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() =>
        router.push({
          pathname: "/messages/request/[id]",
          params: {
            id: group.learningRequestId,
            view,
            ...(proposalId ? { proposalId } : {}),
          },
        })
      }
      style={({ pressed }) => [
        styles.card,
        unread && styles.cardUnread,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={styles.main}>
        <View style={styles.row}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {reference && <Text style={styles.reference}>{reference}</Text>}
          {unread && <View style={styles.dot} />}
        </View>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      <Icon name="chevron" size={14} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
  },
  cardUnread: { backgroundColor: colors.orangePale },
  main: { flex: 1, minWidth: 0, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
    flex: 1,
  },
  summary: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  reference: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.muted,
    flexShrink: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.orange,
  },
});
