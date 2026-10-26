import { Pressable, StyleSheet, Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { Icon, type IconName } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { InboxNotification } from "../api/notifications-api";
import { notificationCopy, notificationTime } from "../utils/notification-copy";
import { useNotificationSender } from "../hooks/use-notification-sender";
import { notificationTarget } from "../utils/notification-target";
import { NotificationTitle } from "./notification-title";

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
  animateTitle,
  onPress,
}: {
  item: InboxNotification;
  busy: boolean;
  disabled: boolean;
  animateTitle: boolean;
  onPress: () => void;
}) {
  const unread = !item.readAt;
  const sender = useNotificationSender(item);
  const copy = notificationCopy(item, sender);
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
          color={unread ? colors.primary : colors.body}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleLine}>
          <NotificationTitle
            text={copy.title}
            style={[styles.title, unread && styles.unreadTitle]}
            animate={animateTitle}
          />
          {unread && <View style={styles.dot} />}
        </View>
        <Text style={styles.body} numberOfLines={1} ellipsizeMode="tail">
          {copy.body}
        </Text>
        <Text style={styles.time}>{notificationTime(item.createdAt)}</Text>
      </View>
      {busy ? (
        <ActivityIndicator presentation="inline" size="small" />
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryMuted,
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
  unreadIcon: { backgroundColor: colors.primaryMuted },
  content: { flex: 1, minWidth: 0, gap: 3 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  unreadTitle: { fontFamily: fonts.bold, color: colors.primary },
  dot: {
    flexShrink: 0,
    width: 7,
    height: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.primary,
  },
  body: { fontFamily: fonts.body, ...typography.secondary, color: colors.body },
  time: {
    marginTop: 4,
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.body,
  },
});
