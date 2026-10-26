import { StyleSheet, Text, View } from "react-native";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import { Icon } from "@/components/Icon";
import { appColors as colors, appRadius, fonts } from "@/constants/theme";
import type { LearningJourney as Journey } from "../journey";

const steps = ["Kết nối", "Nội dung học", "Lịch học", "Chốt lịch"];
export function JourneyProgress({
  step,
  done = false,
}: Readonly<{
  step: number;
  done?: boolean;
}>) {
  return (
    <View
      style={styles.steps}
      accessibilityLabel={`Bước ${step} trên 4: ${steps[step - 1]}`}
    >
      {steps.map((label, index) => {
        const complete = index + 1 < step || done;
        const active = index + 1 === step;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[styles.dot, (complete || active) && styles.activeDot]}
            >
              {complete ? (
                <Icon name="check" size={14} color={colors.white} />
              ) : (
                <Text style={[styles.number, active && styles.activeNumber]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
export function JourneyNextStep({
  journey,
  blocked = false,
}: Readonly<{
  journey: Journey;
  blocked?: boolean;
}>) {
  return (
    <Panel title={journey.title} accent>
      <Copy size="hint">{journey.description}</Copy>
      {journey.action && !blocked && (
        <RouteButton href={journey.action.href}>
          {journey.action.label}
        </RouteButton>
      )}
      {journey.waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text style={styles.waitingLabel}>ĐANG CHỜ ĐỐI TÁC</Text>
          {[...new Set(journey.waiting)].map((item) => (
            <Copy key={item}>{item}</Copy>
          ))}
        </View>
      )}
    </Panel>
  );
}
const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: 6, paddingVertical: 8 },
  step: { flex: 1, alignItems: "center", gap: 8, minWidth: 0 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: { backgroundColor: colors.forest },
  number: { fontFamily: fonts.bold, color: colors.body, fontSize: 13 },
  activeNumber: { color: colors.white },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: colors.body,
  },
  activeLabel: { fontFamily: fonts.bold, color: colors.forest },
  waiting: { gap: 6, paddingTop: 8 },
  waitingLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.forest,
  },
});
