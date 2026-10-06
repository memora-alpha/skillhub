import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import { calendarPeriod, upcomingSessions, weekDays } from "../mocks/calendar";

export function MonthCalendar({
  month,
  selectedDay,
  onMonthChange,
  onDayPress,
}: {
  month: number;
  selectedDay: number | null;
  onMonthChange: (month: number) => void;
  onDayPress: (day: number) => void;
}) {
  const firstWeekDay = new Date(calendarPeriod.year, month, 1).getDay();
  const dayCount = new Date(calendarPeriod.year, month + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekDay + dayCount) / 7) * 7 },
    (_, index) => {
      const day = index - firstWeekDay + 1;
      return day > 0 && day <= dayCount ? day : null;
    },
  );
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          accessibilityLabel="Tháng trước"
          accessibilityState={{ disabled: month === calendarPeriod.firstMonth }}
          disabled={month === calendarPeriod.firstMonth}
          onPress={() => onMonthChange(month - 1)}
          style={styles.arrow}
        >
          <View
            style={{
              transform: [{ rotate: "180deg" }],
              opacity: month === calendarPeriod.firstMonth ? 0.3 : 1,
            }}
          >
            <Icon name="chevron" color={colors.muted} size={18} />
          </View>
        </Pressable>
        <Text accessibilityRole="header" style={styles.month}>
          Tháng {month + 1}, {calendarPeriod.year}
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          accessibilityLabel="Tháng sau"
          accessibilityState={{ disabled: month === calendarPeriod.lastMonth }}
          disabled={month === calendarPeriod.lastMonth}
          onPress={() => onMonthChange(month + 1)}
          style={[
            styles.arrow,
            month === calendarPeriod.lastMonth && { opacity: 0.3 },
          ]}
        >
          <Icon name="chevron" color={colors.muted} size={18} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekDays.map((day) => (
          <Text key={day} style={styles.weekDay}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null)
            return <View key={`blank-${index}`} style={styles.cell} />;
          const today =
            month === calendarPeriod.firstMonth && day === calendarPeriod.today;
          const hasSession =
            month === calendarPeriod.firstMonth &&
            upcomingSessions.some((item) => item.day === day);
          const selected = selectedDay === day;
          return (
            <View key={day} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${day}/${month + 1}/${calendarPeriod.year}${hasSession ? ", có buổi học" : ""}${today ? ", hôm nay trong bản mẫu" : ""}`}
                accessibilityState={{ selected }}
                onPress={() => onDayPress(day)}
                style={[
                  styles.day,
                  hasSession && styles.sessionDay,
                  today && styles.today,
                  selected && styles.selected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    hasSession && {
                      color: colors.brand,
                      fontFamily: fonts.bold,
                    },
                    today && { color: colors.white },
                  ]}
                >
                  {day}
                </Text>
                {hasSession && !today && <View style={styles.dot} />}
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.todayDot} />
          <Text style={styles.caption}>Hôm nay</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.sessionDot} />
          <Text style={styles.caption}>Có buổi học</Text>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  arrow: { padding: 6 },
  month: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink,
  },
  week: { flexDirection: "row", gap: 4 },
  weekDay: {
    flex: 1,
    fontFamily: fonts.semibold,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    paddingVertical: 4,
    textAlign: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: {
    flex: 1,
    borderRadius: 99,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayText: {
    fontFamily: fonts.medium,
    color: colors.body,
    fontSize: 12,
    lineHeight: 16,
  },
  sessionDay: { backgroundColor: colors.brandLight },
  today: { backgroundColor: colors.brand },
  selected: { borderColor: colors.brand },
  dot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.sand,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  todayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandLight,
    borderWidth: 1,
    borderColor: colors.brand,
  },
});
