import { StyleSheet, View } from "react-native";
import { appColors as colors } from "@/constants/theme";

export function ProgressBar({
  value,
  max,
  color = colors.primary,
  label,
  trackColor = colors.surfaceInset,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
  trackColor?: string;
  height?: number;
}) {
  const percent = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={[styles.track, { height, backgroundColor: trackColor }]}
    >
      <View
        style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: colors.surfaceInset,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
});
