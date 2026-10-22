import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { InboxNotification } from "../api/notifications-api";
import { notificationCopy, notificationTime } from "../utils/notification-copy";
import { notificationTarget } from "../utils/notification-target";

function notificationIcon(type: string): IconName {
  if (type.startsWith("chat.")) return "message";
  if (type.startsWith("proposal.")) return "users";
  if (type.startsWith("skill.")) return "award";
  if (type.startsWith("learning-path.")) return "calendar";
  if (type.startsWith("material.")) return "book";
  if (type.startsWith("report.")) return "flag";
  return "bell";
}

export function NotificationRow({
  item,
  busy,
  disabled,
  onPress,
}: {
  item: InboxNotification;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const unread = !item.readAt;
  const copy = notificationCopy(item);
  const target = notificationTarget(item);
  const actionable = unread || !!target;
  return (
    <Pressable
      accessible
      accessibilityRole={actionable ? "button" : "text"}
      accessibilityLabel={`${copy.title}. ${copy.body}. ${notificationTime(item.createdAt)}. ${unread ? "Chưa đọc" : "Đã đọc"}`}
      accessibilityHint={
        target
          ? "Mở nội dung liên quan và đánh dấu đã đọc"
          : unread
            ? "Đánh dấu đã đọc"
            : undefined
      }
      accessibilityState={{ disabled: actionable && disabled, busy }}
      disabled={disabled || !actionable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread && styles.unread,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, unread && styles.unreadIcon]}>
        <Icon
          name={notificationIcon(item.type)}
          size={20}
          color={unread ? colors.forest : colors.body}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, unread && styles.unreadTitle]}>
            {copy.title}
          </Text>
          {unread && <View style={styles.dot} />}
        </View>
        <Text style={styles.body}>{copy.body}</Text>
        <Text style={styles.time}>{notificationTime(item.createdAt)}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.forest} />
      ) : target ? (
        <Icon name="chevron" size={16} color={colors.body} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: {
    backgroundColor: colors.forestSoft,
    borderColor: colors.forestMuted,
  },
  pressed: { opacity: 0.75 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadIcon: { backgroundColor: colors.forestMuted },
  content: { flex: 1, gap: 3 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  unreadTitle: { fontFamily: fonts.bold, color: colors.forest },
  dot: {
    width: 7,
    height: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.success,
  },
  body: { fontFamily: fonts.body, ...typography.secondary, color: colors.body },
  time: {
    marginTop: 4,
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.body,
  },
});
