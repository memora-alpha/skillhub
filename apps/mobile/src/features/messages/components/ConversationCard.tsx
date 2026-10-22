import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { appRadius, avatarSizes, typography, fonts } from "@/constants/theme";
import { messageCardShadow, messageColors as colors } from "../constants/theme";

export function ConversationCard({
  name,
  userId,
  avatarUrl,
  preview,
  time,
  topic,
  reference,
  unread = false,
  onPress,
}: {
  name: string;
  userId?: string;
  avatarUrl?: string | null;
  preview: string;
  time: string;
  topic: string;
  reference: string;
  unread?: boolean;
  onPress: () => void;
}) {
  const unreadLabel = unread ? ", có tin nhắn chưa đọc" : "";
  const accessibilityLabel = `Nhắn tin với ${name}, ${topic}, ${reference}${unreadLabel}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        unread && styles.cardUnread,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <Avatar
            name={name}
            userId={userId}
            size={avatarSizes.list}
            shape="circle"
            sourceUri={avatarUrl}
          />
        </View>

        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text
              numberOfLines={1}
              style={[styles.name, unread && styles.nameUnread]}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.time, unread && styles.timeUnread]}
            >
              {time}
            </Text>
          </View>

          <View style={styles.previewRow}>
            <Text
              numberOfLines={1}
              style={[styles.preview, unread && styles.previewUnread]}
            >
              {preview}
            </Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <View style={styles.topicRow}>
            <Text numberOfLines={1} style={styles.topic}>
              {topic}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: messageCardShadow,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  cardUnread: { backgroundColor: colors.orangePale },
  avatarWrap: { position: "relative", flexShrink: 0 },
  main: { flex: 1, minWidth: 0, gap: 4 },

  // Name row
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    flex: 1,
    minWidth: 0,
  },
  nameUnread: { fontFamily: fonts.bold },
  time: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.mutedLight,
    flexShrink: 0,
  },

  preview: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
    flex: 1,
    minWidth: 0,
  },
  previewUnread: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: appRadius.full,
    backgroundColor: colors.orange,
    flexShrink: 0,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  topic: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    flex: 1,
    minWidth: 0,
  },
  timeUnread: { color: colors.orange, fontFamily: fonts.bold },
});
