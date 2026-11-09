import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export type AgreementStep = "method" | "plans" | "schedules" | "completion";
export const agreementSteps: AgreementStep[] = [
  "method",
  "plans",
  "schedules",
  "completion",
];
const labels = ["Cách học", "Lộ trình", "Lịch học", "Hoàn tất"];

function stepDescription(
  index: number,
  currentIndex: number,
  completed: boolean,
  scheduleLocked: boolean,
) {
  if (index === 2 && scheduleLocked) return "Đã chốt lịch";
  if (index === 3 && index === currentIndex)
    return completed ? "Đã hoàn thành" : "Chờ quyết toán";
  if (completed || index < currentIndex) return "Đã thống nhất";
  if (index === currentIndex) return "Đang thống nhất";
  return "Chưa bắt đầu";
}

export function AgreementSteps({
  value,
  current,
  onSelect,
  completed = false,
  scheduleLocked = false,
}: Readonly<{
  value: AgreementStep;
  current: AgreementStep;
  onSelect: (step: AgreementStep) => void;
  completed?: boolean;
  scheduleLocked?: boolean;
}>) {
  const currentIndex = agreementSteps.indexOf(current);
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.headingTitle}>
          {labels[agreementSteps.indexOf(value)]}
        </Text>
        <Text style={styles.caption}>
          {stepDescription(
            agreementSteps.indexOf(value),
            currentIndex,
            completed,
            scheduleLocked,
          )}
        </Text>
      </View>
      <View style={styles.steps}>
        <View pointerEvents="none" style={styles.track}>
          {agreementSteps.slice(1).map((step, index) => (
            <View
              key={step}
              style={[styles.segment, index < currentIndex && styles.doneTrack]}
            />
          ))}
        </View>
        {agreementSteps.map((step, index) => {
          const disabled = !completed && index > currentIndex;
          const done =
            completed ||
            index < currentIndex ||
            (step === "schedules" && scheduleLocked);
          const selected = value === step;
          return (
            <Pressable
              key={step}
              accessibilityRole="button"
              accessibilityLabel={`Bước ${index + 1}: ${labels[index]}`}
              accessibilityHint={stepDescription(
                index,
                currentIndex,
                completed,
                scheduleLocked,
              )}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(step)}
              style={styles.step}
            >
              <View
                style={[
                  styles.circle,
                  done && styles.doneCircle,
                  selected && styles.selectedCircle,
                ]}
              >
                {done ? (
                  <Icon
                    name="check"
                    size={16}
                    color={selected ? colors.white : colors.forest}
                  />
                ) : (
                  <Text
                    style={[styles.number, selected && styles.selectedNumber]}
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  headingTitle: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  steps: { flexDirection: "row" },
  track: {
    position: "absolute",
    top: 15,
    left: "12.5%",
    right: "12.5%",
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
    justifyContent: "flex-start",
    gap: 4,
  },
  disabled: { opacity: 0.5 },
  number: { ...typography.body, fontFamily: fonts.bold, color: colors.muted },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
    textAlign: "center",
  },
  active: { color: colors.primary },
});
