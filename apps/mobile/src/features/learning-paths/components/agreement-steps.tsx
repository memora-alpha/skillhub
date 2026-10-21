import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export type AgreementStep = "method" | "plans" | "schedules";
const steps: AgreementStep[] = ["method", "plans", "schedules"];
const labels = ["Cách học", "Lộ trình", "Lịch học"];

export function AgreementSteps({
  value,
  current,
  onSelect,
}: Readonly<{
  value: AgreementStep;
  current: AgreementStep;
  onSelect: (step: AgreementStep) => void;
}>) {
  const currentIndex = steps.indexOf(current);
  return (
    <View style={styles.steps}>
      <View pointerEvents="none" style={styles.track}>
        {steps.slice(1).map((step, index) => (
          <View
            key={step}
            style={[styles.segment, index < currentIndex && styles.doneTrack]}
          />
        ))}
      </View>
      {steps.map((step, index) => {
        const disabled = index > currentIndex;
        const selected = value === step;
        return (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityLabel={`Bước ${index + 1}: ${labels[index]}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(step)}
            style={styles.step}
          >
            <View
              style={[
                styles.circle,
                index < currentIndex && styles.doneCircle,
                selected && styles.selectedCircle,
              ]}
            >
              {index < currentIndex ? (
                <Icon
                  name="check"
                  size={16}
                  color={selected ? colors.white : colors.forest}
                />
              ) : (
                <Text
                  style={[
                    styles.number,
                    index < currentIndex && styles.doneNumber,
                    selected && styles.selectedNumber,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.label,
                disabled && styles.disabled,
                selected && styles.active,
              ]}
            >
              {labels[index]}
            </Text>
            <Text style={[styles.caption, selected && styles.active]}>
              {index < currentIndex
                ? "Đã thống nhất"
                : index === currentIndex
                  ? "Đang thống nhất"
                  : "Chưa bắt đầu"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  steps: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  track: {
    position: "absolute",
    top: 23,
    left: "16.66%",
    right: "16.66%",
    flexDirection: "row",
  },
  segment: { flex: 1, height: 2, backgroundColor: colors.surfaceInset },
  doneTrack: { backgroundColor: colors.primary },
  circle: {
    width: 30,
    height: 30,
    borderRadius: appRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLow,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  selectedCircle: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryMuted,
  },
  doneCircle: { backgroundColor: colors.forestSoft },
  selectedNumber: { color: colors.white },
  doneNumber: { color: colors.forest },
  caption: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: "center",
  },
  step: {
    flex: 1,
    minHeight: 64,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  disabled: { opacity: 0.5 },
  number: { ...typography.body, fontFamily: fonts.bold, color: colors.muted },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  active: { color: colors.primary },
});
