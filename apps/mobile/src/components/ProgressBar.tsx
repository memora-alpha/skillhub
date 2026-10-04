import { StyleSheet, View } from "react-native";
import { colors } from "@/constants/theme";

export function ProgressBar({
  value,
  max,
  color = colors.brand,
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
}) {
  const percent = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={styles.track}
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
    backgroundColor: colors.sand,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
});
