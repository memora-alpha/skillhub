import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors, colors, fonts, typography } from "@/constants/theme";

export function ChatNotice({
  label,
  title,
  summary,
  status,
  tone = "info",
  icon = "calendar",
  actionLabel,
  onPress,
}: Readonly<{
  label: string;
  title: string;
  summary?: string;
  status?: string;
  tone?: "info" | "success";
  icon?: IconName;
  actionLabel?: string;
  onPress?: () => void;
}>) {
  const success = tone === "success";
  const accent = success ? appColors.forest : appColors.primary;
  const summaryHint = summary ? `. ${summary}` : "";
  return (
    <View style={[styles.card, success ? styles.success : styles.info]}>
      <View style={styles.row}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: success
                ? appColors.forestMuted
                : appColors.primaryMuted,
            },
          ]}
        >
          <Icon name={icon} size={16} color={accent} />
        </View>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={[styles.label, { color: accent }]}>{label}</Text>
            {!!status && (
              <Text style={[styles.status, { color: accent }]}>{status}</Text>
            )}
          </View>
          <Text selectable style={styles.title}>
            {title}
          </Text>
          {!!summary && (
            <Text selectable style={styles.summary}>
              {summary}
            </Text>
          )}
        </View>
      </View>
      {!!onPress && !!actionLabel && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint={`${label}. ${title}${summaryHint}`}
          onPress={onPress}
          style={({ pressed }) => [
            styles.action,
            {
              borderTopColor: success
                ? appColors.forestMuted
                : appColors.primaryMuted,
            },
            pressed && { opacity: 0.65 },
          ]}
        >
          <Text style={[styles.actionText, { color: accent }]}>
            {actionLabel}
          </Text>
          <Icon name="chevron" size={16} color={accent} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    width: "92%",
    maxWidth: 360,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
    borderWidth: 1,
  },
  info: { backgroundColor: colors.brandLight, borderColor: colors.brandMuted },
  success: {
    backgroundColor: appColors.forestSoft,
    borderColor: appColors.forestMuted,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, minWidth: 0, gap: 4 },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 3,
  },
  label: { ...typography.caption, fontFamily: fonts.bold },
  status: { ...typography.caption, fontFamily: fonts.semibold },
  title: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: appColors.ink,
  },
  summary: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: appColors.body,
  },
  action: {
    minHeight: 44,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  actionText: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    flexShrink: 1,
  },
});
