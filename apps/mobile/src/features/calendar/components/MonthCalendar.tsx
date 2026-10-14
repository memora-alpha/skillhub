import { styles } from "./MonthCalendar.styles";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { fonts } from "@/constants/theme";
import { weekDays } from "../mocks/calendar";
import { calendarColors as colors } from "../constants/theme";

type CalendarCell = Readonly<{ key: string; day: number | null }>;

export function MonthCalendar({
  month,
  year,
  sessionDays,
  selectedDay,
  onMonthChange,
  onDayPress,
}: {
  month: number;
  year: number;
  sessionDays: number[];
  selectedDay: number | null;
  onMonthChange: (month: number) => void;
  onDayPress: (day: number) => void;
}) {
  const firstWeekDay = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const currentDate = new Date();
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
        <Text accessibilityRole="header" style={styles.month}>
          Tháng {month + 1}, {year}
        </Text>
        <View style={styles.arrows}>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            accessibilityLabel="Tháng trước"
            onPress={() => onMonthChange(month - 1)}
            style={styles.arrow}
          >
            <View
              style={{
                transform: [{ rotate: "180deg" }],
              }}
            >
              <Icon name="chevron" color={colors.muted} size={18} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            accessibilityLabel="Tháng sau"
            onPress={() => onMonthChange(month + 1)}
            style={[styles.arrow]}
          >
            <Icon name="chevron" color={colors.muted} size={18} />
          </Pressable>
        </View>
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
                month === currentDate.getMonth() &&
                year === currentDate.getFullYear() &&
                day === currentDate.getDate();
              const hasSession = sessionDays.includes(day);
              const selected = selectedDay === day;
              return (
                <View key={cell.key} style={styles.cell}>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={4}
                    accessibilityLabel={`${day}/${month + 1}/${year}${hasSession ? ", có buổi học" : ""}${today ? ", hôm nay" : ""}`}
                    accessibilityState={{ selected }}
                    aria-pressed={selected}
                    onPress={() => onDayPress(day)}
                    style={[styles.day, selected && styles.circled]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && {
                          fontFamily: fonts.semibold,
                        },
                        selected && { color: colors.orange },
                        today && {
                          color: colors.orange,
                          fontFamily: fonts.bold,
                        },
                      ]}
                    >
                      {day}
                    </Text>
                    {hasSession && (
                      <View
                        style={[
                          styles.dayDot,
                          selected && styles.selectedDayDot,
                        ]}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
