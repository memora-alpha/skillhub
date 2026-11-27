import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChatParticipantAvatar } from "./ChatParticipantAvatar";
import { Icon } from "@/components/Icon";
import { ChatNotice } from "./ChatNotice";
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
  expandSummary = false,
  variant = "card",
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
  expandSummary?: boolean;
  variant?: "card" | "notice";
  confirmed: boolean;
  onPress: () => void;
}>) {
  const status = badgeLabel ?? (confirmed ? "Đã xác nhận" : "Được chia sẻ");
  const versionHint = version ? `, bản ${version}` : "";
  if (variant === "notice")
    return (
      <ChatNotice
        label={label}
        title={title}
        summary={summary}
        status={status}
        tone={confirmed ? "success" : "info"}
        icon={confirmed ? "check-circle" : "calendar"}
        actionLabel={actionText}
        onPress={onPress}
      />
    );
  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, mine && styles.mine]}>
        <ChatParticipantAvatar
          mine={mine}
          showAvatar={showAvatar}
          partner={partner}
          partnerId={partnerId}
          avatarUrl={avatarUrl}
          size={24}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityHint={`${label}${versionHint}. ${title}. ${summary}`}
          onPress={onPress}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
        >
          <WorkflowHeader confirmed={confirmed} label={label} status={status} />
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {!!summary && (
            <Text
              numberOfLines={expandSummary ? undefined : 2}
              style={styles.summary}
            >
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
function WorkflowHeader({
  confirmed,
  label,
  status,
}: Readonly<{ confirmed: boolean; label: string; status: string }>) {
  return (
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
        <Text style={[styles.badgeLabel, confirmed && styles.confirmedLabel]}>
          {status}
        </Text>
      </View>
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
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  heading: { flex: 1, minWidth: 80 },
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
