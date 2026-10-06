import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { colors, fonts, radius } from "@/constants/theme";
import type { LearningPathHistory, UpcomingSession } from "../mocks/calendar";

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
        <Icon name="calendar" size={18} color={tint} />
      </View>
      <View style={styles.main}>
        <View style={styles.row}>
          <Text style={[styles.title, { flex: 1 }]}>{session.title}</Text>
          <Text style={[styles.role, { color: tint }]}>{session.role}</Text>
        </View>
        <Text style={styles.caption}>{session.time}</Text>
        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={[styles.caption, { flex: 1 }]}>
            Với {session.partner}
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem lộ trình: ${path.name}`}
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
              backgroundColor: cancelled
                ? colors.errorLight
                : teaching
                  ? colors.sageLight
                  : colors.brandLight,
            },
          ]}
        >
          <Icon
            name={cancelled ? "alert" : "book"}
            size={16}
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
            {path.sessionList.map((done, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  { backgroundColor: done ? tint : colors.border },
                ]}
              />
            ))}
          </View>
          <View style={styles.row}>
            <View
              style={styles.stars}
              accessibilityLabel={`${path.rating}/5 sao`}
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Icon
                  key={index}
                  name="star"
                  size={10}
                  filled={index < path.rating}
                  color={index < path.rating ? colors.star : colors.border}
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
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  historyCard: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  role: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
  },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.sand,
    borderRadius: radius.badge,
  },
  countText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
  },
  credit: { maxWidth: "30%", alignItems: "flex-end" },
  creditText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
  },
  creditNote: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "right",
  },
  indented: { paddingLeft: 44, gap: 12 },
  progress: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 99 },
  stars: { flexDirection: "row", gap: 2 },
});
