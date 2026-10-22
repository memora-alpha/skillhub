import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function ChatWorkflowCard({
  mine,
  partner,
  partnerId,
  avatarUrl,
  label,
  title,
  summary,
  version,
  action,
  time,
  confirmed,
  onPress,
  badgeLabel,
  actionText = "Xem chi tiết",
  showAvatar = true,
}: Readonly<{
  mine: boolean;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  label: string;
  title: string;
  summary: string;
  version?: number;
  badgeLabel?: string;
  actionText?: string;
  action: string;
  time?: string;
  showAvatar?: boolean;
  confirmed: boolean;
  onPress: () => void;
}>) {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, mine && styles.mine]}>
        {!mine &&
          (showAvatar ? (
            <Avatar
              name={partner}
              userId={partnerId}
              sourceUri={avatarUrl}
              size={24}
            />
          ) : (
            <View style={{ width: 24 }} />
          ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityHint={`${label}${version ? `, bản ${version}` : ""}. ${title}. ${summary}`}
          onPress={onPress}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.header}>
            <View style={[styles.icon, confirmed && styles.confirmed]}>
              <Icon
                name={confirmed ? "check-circle" : "clipboard"}
                size={18}
                color={confirmed ? colors.forest : colors.primary}
              />
            </View>
            <View style={styles.heading}>
              <Text style={styles.label}>{label}</Text>
            </View>
            <View style={[styles.badge, confirmed && styles.confirmed]}>
              <Text
                style={[styles.badgeLabel, confirmed && styles.confirmedLabel]}
              >
                {badgeLabel ?? (confirmed ? "Đã xác nhận" : "Được chia sẻ")}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {!!summary && (
            <Text numberOfLines={2} style={styles.summary}>
              {summary}
            </Text>
          )}
          <View style={styles.footer}>
            <Text style={styles.version}>
              {mine ? "Bạn" : "Đối tác"}
              {version ? ` · Bản ${version}` : ""}
            </Text>
            <View style={styles.link}>
              <Text style={styles.action}>{actionText}</Text>
              <Icon name="arrow" size={14} color={colors.primary} />
            </View>
          </View>
        </Pressable>
      </View>
      {!!time && (
        <Text style={[styles.time, !mine && styles.theirTime]}>{time}</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  mine: { justifyContent: "flex-end" },
  card: {
    width: "88%",
    maxWidth: 340,
    padding: 14,
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { flex: 1, minWidth: 0 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: appRadius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  confirmed: { backgroundColor: colors.forestSoft },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: appRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeLabel: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  confirmedLabel: { color: colors.forest },
  label: { ...typography.secondary, fontFamily: fonts.bold, color: colors.ink },
  title: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  summary: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  version: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    gap: 8,
    flexWrap: "wrap",
  },
  link: { flexDirection: "row", alignItems: "center", gap: 6 },
  action: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  time: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: "right",
  },
  theirTime: { textAlign: "left", marginLeft: 32 },
});
