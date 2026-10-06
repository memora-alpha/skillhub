import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors, fonts, radius } from "@/constants/theme";
import type { Conversation } from "../mocks/conversations";

export function ConversationCard({
  conversation,
  unread,
  onPress,
}: {
  conversation: Conversation;
  unread: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem trao đổi với ${conversation.name}${unread ? `, ${unread} tin chưa đọc` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        unread > 0 && styles.unread,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.row}>
        <View>
          <Avatar name={conversation.name} size={48} />
          {unread > 0 && (
            <View style={styles.count}>
              <Text style={styles.countText}>{unread}</Text>
            </View>
          )}
        </View>
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{conversation.name}</Text>
            <Text style={styles.time}>{conversation.time}</Text>
          </View>
          <View style={styles.proposalRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Proposal đã chấp nhận</Text>
            </View>
            <Text style={styles.proposal}>#{conversation.proposal}</Text>
          </View>
          <Text numberOfLines={1} style={styles.request}>
            {conversation.skill} · {conversation.request}
          </Text>
          <Text numberOfLines={1} style={styles.preview}>
            {conversation.last}
          </Text>
          <Text style={styles.messageCount}>
            {conversation.messages} tin nhắn
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  unread: { backgroundColor: colors.brandLight },
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  main: { flex: 1, minWidth: 0, gap: 6 },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  proposalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.badge,
    backgroundColor: colors.sageLight,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.sage,
  },
  proposal: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
  },
  request: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  messageCount: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.mutedLight,
  },
  count: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.white,
  },
});
