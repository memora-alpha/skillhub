import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { iconSizes, typography, fonts } from "@/constants/theme";
import {
  calendarCardShadow,
  calendarColors as colors,
} from "../constants/theme";
import type { LearningPathHistory, UpcomingSession } from "../mocks/calendar";

const ratingStars = [1, 2, 3, 4, 5] as const;

export function UpcomingSessionCard({
  session,
  onPress,
}: {
  session: UpcomingSession;
  onPress: () => void;
}) {
  const teaching = session.role === "Dạy";
  const tint = teaching ? colors.sage : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem buổi học: ${session.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: teaching ? colors.sageLight : colors.brandLight },
        ]}
      >
        <Icon name="calendar" size={iconSizes.feature} color={tint} />
      </View>
      <View style={styles.main}>
        <View style={styles.row}>
          <Text style={[styles.title, { flex: 1 }]}>{session.title}</Text>
          <View
            style={[
              styles.roleBadge,
              {
                borderColor: teaching ? colors.green : colors.orange,
                backgroundColor: teaching
                  ? colors.greenSoft
                  : colors.orangeSoft,
              },
            ]}
          >
            <Text style={[styles.role, { color: tint }]}>{session.role}</Text>
          </View>
        </View>
        <View style={styles.timeRow}>
          <Icon name="clock" size={iconSizes.inline} color={colors.orange} />
          <Text style={styles.caption}>{session.time}</Text>
        </View>
        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={[styles.caption, { flex: 1 }]}>
            Mentor: <Text style={styles.partner}>{session.partner}</Text>
          </Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{session.days} ngày nữa</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
export function HistoryPathCard({
  path,
  onPress,
}: {
  path: LearningPathHistory;
  onPress: () => void;
}) {
  const cancelled = path.status === "cancelled";
  const teaching = path.role === "Dạy";
  const tint = teaching ? colors.sage : colors.brand;
  let historyIconBackground: string = teaching
    ? colors.sageLight
    : colors.brandLight;
  if (cancelled) historyIconBackground = colors.errorLight;
  const sessionSteps = path.sessionList.map((done, position) => ({
    done,
    id: `${path.id}-${path.sessionDates[position]}`,
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem Learning Path: ${path.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.historyCard, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.icon,
            {
              width: 36,
              height: 36,
              backgroundColor: historyIconBackground,
            },
          ]}
        >
          <Icon
            name={cancelled ? "alert" : "book"}
            size={iconSizes.control}
            color={cancelled ? colors.error : tint}
          />
        </View>
        <View style={styles.main}>
          <Text style={styles.title}>{path.name}</Text>
          <Text style={styles.caption}>
            Với {path.partner} · {path.sessions} buổi · {path.period}
          </Text>
        </View>
        <View style={styles.credit}>
          <Text
            style={[
              styles.creditText,
              { color: cancelled ? colors.error : tint },
            ]}
          >
            {cancelled ? "Đã hủy" : path.credit}
          </Text>
          {!cancelled && (
            <Text style={styles.creditNote}>nhận khi hoàn tất</Text>
          )}
        </View>
      </View>
      {!cancelled && (
        <View style={styles.indented}>
          <View
            style={styles.progress}
            accessibilityLabel={`Hoàn thành ${path.sessionList.filter(Boolean).length}/${path.sessions} buổi`}
          >
            {sessionSteps.map((step) => (
              <View
                key={step.id}
                style={[
                  styles.segment,
                  { backgroundColor: step.done ? tint : colors.border },
                ]}
              />
            ))}
          </View>
          <View style={styles.row}>
            <View
              style={styles.stars}
              accessibilityLabel={`${path.rating}/5 sao`}
            >
              {ratingStars.map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={10}
                  filled={star <= path.rating}
                  color={star <= path.rating ? colors.star : colors.border}
                />
              ))}
            </View>
            <Text style={styles.caption}>Đánh giá của bạn</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: calendarCardShadow,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  historyCard: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
    includeFontPadding: false,
  },
  role: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    flexShrink: 0,
  },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.orangeSoft,
    borderRadius: 5,
  },
  countText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.orange,
  },
  credit: { maxWidth: "30%", alignItems: "flex-end" },
  creditText: {
    fontFamily: fonts.bold,
    ...typography.body,
    textAlign: "right",
  },
  creditNote: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
    textAlign: "right",
  },
  indented: { paddingLeft: 44, gap: 12 },
  progress: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 99 },
  stars: { flexDirection: "row", gap: 2 },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  partner: { fontFamily: fonts.bold, color: colors.ink },
});
