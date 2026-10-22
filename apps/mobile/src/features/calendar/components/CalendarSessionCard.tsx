import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";
import { fonts, typography } from "@/constants/theme";
import {
  sessionPresentation,
  sessionDuration,
  formatSessionTime,
  type LearningSession,
} from "@/features/sessions";
import {
  calendarColors as colors,
  calendarCardShadow,
  calendarButtonShadow,
} from "../constants/theme";

export function CalendarSessionCard({
  session,
  timezone,
}: Readonly<{
  session: LearningSession;
  timezone: string;
}>) {
  const router = useRouter();
  const presentation = sessionPresentation(session);
  const label =
    presentation.label === "Đã kết thúc · chờ xác nhận"
      ? "Chờ xác nhận"
      : presentation.label;
  const warning = presentation.variant === "warning";
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Buổi học
        </Text>
        <View
          style={[
            styles.badge,
            warning && styles.warningBadge,
            session.status === "CANCELLED" && styles.cancelledBadge,
          ]}
        >
          <View
            style={[
              styles.dot,
              warning && { backgroundColor: colors.orange },
              session.status === "CANCELLED" && {
                backgroundColor: colors.muted,
              },
            ]}
          />
          <Text
            style={[
              styles.status,
              warning && { color: colors.orangeDark },
              session.status === "CANCELLED" && { color: colors.muted },
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.row}>
          <Icon name="users" color={colors.muted} size={18} />
          <Text style={styles.role}>
            Bạn {session.role === "TEACHER" ? "dạy" : "học"} ·{" "}
            {sessionDuration(session)} phút
          </Text>
        </View>
        <View style={styles.row}>
          <Icon name="clock" color={colors.muted} size={18} />
          <Text style={styles.time}>
            {formatSessionTime(session.startAt, timezone)}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở buổi học"
        onPress={() => router.push(`/learning-sessions/${session.id}`)}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient
          colors={[colors.orange, colors.orangeDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={styles.actionLabel}>Mở buổi học</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: calendarCardShadow,
    gap: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    flexShrink: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.greenSoft,
    flexShrink: 1,
  },
  warningBadge: { backgroundColor: colors.orangeSoft },
  cancelledBadge: { backgroundColor: colors.segment },
  status: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.green,
    flexShrink: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  meta: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  role: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.ink,
    flexShrink: 1,
  },
  time: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
    flexShrink: 1,
  },
  action: { borderRadius: 12, boxShadow: calendarButtonShadow, marginTop: 2 },
  gradient: {
    borderRadius: 12,
    minHeight: 50,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.surface,
  },
});
