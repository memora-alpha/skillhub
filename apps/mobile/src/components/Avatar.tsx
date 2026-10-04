import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";

export function Avatar({
  name,
  size = 40,
  ring = false,
}: {
  name: string;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        ring && {
          boxShadow: `0 0 0 2px ${colors.cream}, 0 0 0 4px ${colors.brand}`,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: size <= 32 ? 12 : size >= 96 ? 24 : size >= 64 ? 20 : 14,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.displayBold,
    color: colors.brand,
    includeFontPadding: false,
  },
});
