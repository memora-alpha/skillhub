import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { appColors as colors, fonts } from "@/constants/theme";

export function RequestCalendar({
  value,
  onChange,
}: Readonly<{
  value: Date;
  onChange: (date: Date) => void;
}>) {
  const [month, setMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const selectedDay = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
  const move = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          accessibilityState={{ disabled: month <= firstMonth }}
          disabled={month <= firstMonth}
          onPress={() => move(-1)}
          style={[styles.arrow, month <= firstMonth && { opacity: 0.4 }]}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.month}>
          {month.toLocaleDateString("vi-VN", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() => move(1)}
          style={styles.arrow}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.weekday}>{label}</Text>
          </View>
        ))}
        {Array.from({ length: offset + count }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1) return <View key={index} style={styles.cell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const selected = date.getTime() === selectedDay;
          const disabled = date < today;
          return (
            <View key={index} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={date.toLocaleDateString("vi-VN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(date)}
                style={[
                  styles.day,
                  selected && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    disabled && { color: colors.mutedLight },
                    selected && {
                      color: colors.white,
                      fontFamily: fonts.semibold,
                    },
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontFamily: fonts.body, fontSize: 18, color: colors.ink },
  month: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", alignItems: "center", justifyContent: "center" },
  weekday: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    paddingVertical: 6,
  },
  day: {
    minHeight: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
  },
});
