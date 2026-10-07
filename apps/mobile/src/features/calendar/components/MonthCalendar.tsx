import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { typography, fonts } from "@/constants/theme";
import { calendarPeriod, weekDays } from "../mocks/calendar";
import {
  calendarCardShadow,
  calendarColors as colors,
} from "../constants/theme";

type CalendarCell = Readonly<{ key: string; day: number | null }>;

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
  const cells: CalendarCell[] = Array.from(
    { length: Math.ceil((firstWeekDay + dayCount) / 7) * 7 },
    (_, position) => {
      const day = position - firstWeekDay + 1;
      if (day > 0 && day <= dayCount) return { key: `day-${day}`, day };
      const blankPosition = day <= 0 ? `leading-${1 - day}` : `trailing-${day}`;
      return { key: blankPosition, day: null };
    },
  );
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
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
        {weeks.map((week) => (
          <View key={week[0]!.key} style={styles.week}>
            {week.map((cell) => {
              const { day } = cell;
              if (day === null)
                return <View key={cell.key} style={styles.cell} />;
              const today =
                month === calendarPeriod.initialMonth &&
                day === calendarPeriod.today;
              const hasSession =
                month === calendarPeriod.initialMonth &&
                calendarPeriod.sessionDays.includes(day);
              const selected = selectedDay === day;
              return (
                <View key={cell.key} style={styles.cell}>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={4}
                    accessibilityLabel={`${day}/${month + 1}/${calendarPeriod.year}${hasSession ? ", có buổi học" : ""}${today ? ", hôm nay trong bản mẫu" : ""}`}
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                    onPress={() => onDayPress(day)}
                    style={[
                      styles.day,
                      hasSession && styles.sessionDay,
                      selected && styles.selected,
                      today && styles.today,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        hasSession && {
                          color: colors.orange,
                          fontFamily: fonts.bold,
                        },
                        today && { color: colors.surface },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    boxShadow: calendarCardShadow,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  arrow: { padding: 5 },
  month: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  week: { flexDirection: "row" },
  weekDay: {
    flex: 1,
    fontFamily: fonts.semibold,
    color: colors.muted,
    ...typography.caption,
    paddingVertical: 3,
    textAlign: "center",
  },
  grid: { gap: 1 },
  cell: {
    flex: 1,
    minWidth: 0,
    height: 36,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayText: {
    fontFamily: fonts.medium,
    color: colors.body,
    ...typography.secondary,
    fontVariant: ["tabular-nums"],
  },
  sessionDay: {
    backgroundColor: colors.surface,
    borderColor: colors.orange,
    borderWidth: 1.5,
  },
  today: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  selected: {
    backgroundColor: colors.orangeSoft,
    borderColor: colors.orange,
    boxShadow: "0 0 0 2px rgba(239, 101, 61, 0.12)",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  caption: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  todayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.orange,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.orange,
  },
});
