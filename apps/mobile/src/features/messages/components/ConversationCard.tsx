import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { avatarSizes, typography, fonts } from "@/constants/theme";
import type { Conversation } from "../mocks/conversations";
import { messageCardShadow, messageColors as colors } from "../constants/theme";

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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.72 }]}
    >
      <View style={styles.row}>
        {/* Avatar + unread badge */}
        <View style={styles.avatarWrap}>
          <Avatar
            name={conversation.name}
            userId={conversation.userId}
            size={avatarSizes.list}
          />
          {unread > 0 && (
            <View style={styles.count}>
              <Text style={styles.countText}>{unread}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.main}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={styles.nameLeft}>
              <Text
                numberOfLines={1}
                style={[styles.name, unread > 0 && styles.nameUnread]}
              >
                {conversation.name}
              </Text>
              {/* Skill badge */}
              <View style={styles.skillBadge}>
                <Text style={styles.skillText}>{conversation.skill}</Text>
              </View>
            </View>
            <Text style={[styles.time, unread > 0 && styles.timeUnread]}>
              {conversation.time}
            </Text>
          </View>

          {/* Preview message */}
          <Text
            numberOfLines={1}
            style={[styles.preview, unread > 0 && styles.previewUnread]}
          >
            {conversation.last}
          </Text>

          {/* Course / request subtitle */}
          <Text numberOfLines={1} style={styles.request}>
            {conversation.request}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.surface,
    borderRadius: 10,
    boxShadow: messageCardShadow,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  avatarWrap: { position: "relative", flexShrink: 0 },
  main: { flex: 1, minWidth: 0, gap: 2 },

  // Name row
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  nameLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  name: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
    flexShrink: 1,
  },
  nameUnread: {
    fontFamily: fonts.bold,
  },
  time: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.mutedLight,
    flexShrink: 0,
  },

  skillBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.tag,
    flexShrink: 0,
  },
  skillText: {
    fontFamily: fonts.medium,
    ...typography.caption,
    color: colors.muted,
  },
  preview: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
  },
  previewUnread: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },

  request: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.mutedLight,
  },

  count: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
    includeFontPadding: false,
    color: colors.white,
  },
  timeUnread: { color: colors.orange, fontFamily: fonts.bold },
});
