import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  typography,
  appColors as colors,
  appRadius as radius,
  fonts,
} from "@/constants/theme";

export function Tag({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
  );
  if (!onPress) return <View style={styles.tag}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tag,
        active && styles.active,
        pressed && { opacity: 0.75 },
      ]}
    >
      {content}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    borderRadius: radius.badge,
    backgroundColor: colors.surfaceInset,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  active: { backgroundColor: colors.forest },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
    includeFontPadding: false,
  },
  activeLabel: { color: colors.white },
});
