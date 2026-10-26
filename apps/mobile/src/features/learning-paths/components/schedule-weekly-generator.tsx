import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScheduleTimeFields } from "./schedule-time-fields";
import { Button } from "@/components/Button";
import { FlowSection } from "@/components/learning-flow";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { generateWeeklySchedule } from "../utils/weekly-schedule";
import type { ScheduleInput } from "../schemas/schedule-input";

const days = [
  { day: 1, label: "T2" },
  { day: 2, label: "T3" },
  { day: 3, label: "T4" },
  { day: 4, label: "T5" },
  { day: 5, label: "T6" },
  { day: 6, label: "T7" },
  { day: 0, label: "CN" },
];
export function ScheduleWeeklyGenerator({
  count,
  disabled,
  onApply,
}: Readonly<{
  count: number;
  disabled: boolean;
  onApply: (items: ScheduleInput["items"]) => void;
}>) {
  const [selected, setSelected] = useState<number[]>([]);
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [error, setError] = useState<string>();
  const applyTemplate = () => {
    if (disabled) return;
    setError(undefined);
    try {
      onApply(
        generateWeeklySchedule({ start, days: selected, minutes }, count),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Chưa thể điền lịch.",
      );
    }
  };
  return (
    <FlowSection>
      <View style={styles.sectionHeading}>
        <Text style={styles.number}>1</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Lên lịch theo tuần
        </Text>
      </View>
      <Text style={styles.note}>
        Điền lịch cho {count} buổi, sau đó xem lại và chỉnh riêng từng buổi.
      </Text>
      <Text style={styles.label}>Chọn thứ trong tuần</Text>
      <View style={styles.days}>
        {days.map(({ day, label }) => {
          const checked = selected.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityLabel={day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onPress={() => {
                const next = checked
                  ? selected.filter((value) => value !== day)
                  : [...selected, day];
                setSelected(next);
                setError(undefined);
              }}
              style={[
                styles.day,
                checked && styles.selected,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.dayLabel, checked && styles.selectedLabel]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!!selected.length && (
        <View style={styles.selectionNote}>
          <Icon name="check-circle" size={14} color={colors.primary} />
          <Text style={styles.note}>
            Đã chọn{" "}
            {days
              .filter(({ day }) => selected.includes(day))
              .map(({ day }) => (day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`))
              .join(", ")}
          </Text>
        </View>
      )}
      <ScheduleTimeFields
        local={start}
        minutes={minutes}
        onLocalChange={(value) => {
          setStart(value);
          setError(undefined);
        }}
        onMinutesChange={(value) => {
          setMinutes(value);
          setError(undefined);
        }}
        disabled={disabled}
      />
      {error === "Chọn ngày và giờ bắt đầu." && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.presets}>
        {[60, 90, 120, 180].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={`${value} phút`}
            accessibilityState={{
              checked: minutes === String(value),
              disabled,
            }}
            disabled={disabled}
            onPress={() => {
              setMinutes(String(value));
              setError(undefined);
            }}
            style={[
              styles.preset,
              minutes === String(value) && styles.activePreset,
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                minutes === String(value) && styles.activePresetLabel,
              ]}
            >
              {value} phút
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>
        Nhấn Áp dụng sẽ điền lại toàn bộ {count} buổi, thay cả các buổi đã sửa
        riêng.
      </Text>
      {!!error && error !== "Chọn ngày và giờ bắt đầu." && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        variant="secondary"
        style={styles.applyButton}
        disabled={disabled}
        onPress={applyTemplate}
      >
        {`Áp dụng cho ${count} buổi`}
      </Button>
    </FlowSection>
  );
}
const styles = StyleSheet.create({
  applyButton: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderStrong,
  },
  error: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  number: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.ink,
    backgroundColor: colors.surfaceInset,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  title: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
    flexShrink: 1,
  },
  selectionNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  preset: {
    flexGrow: 1,
    minWidth: 54,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.button,
    backgroundColor: colors.surfaceLow,
  },
  activePreset: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderStrong,
  },
  activePresetLabel: { color: colors.ink, fontFamily: fonts.bold },
  label: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
  note: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  days: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryMuted,
  },
  dayLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  selectedLabel: { color: colors.primary, fontFamily: fonts.bold },
  disabled: { opacity: 0.5 },
});
