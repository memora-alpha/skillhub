import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";

export function Avatar({
  name,
  size = 40,
  ring = false,
  tone = "soft",
}: {
  name: string;
  size?: number;
  ring?: boolean;
  tone?: "soft" | "accent";
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
        tone === "accent" && styles.accent,
        { width: size, height: size, borderRadius: size / 2 },
        ring && styles.ring,
      ]}
    >
      <Text
        style={[
          styles.initials,
          tone === "accent" && styles.accentInitials,
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
  ring: {
    borderWidth: 3,
    borderColor: colors.brand,
  },
  accent: { backgroundColor: colors.brandHover },
  accentInitials: { color: colors.white },
  initials: {
    fontFamily: fonts.displayBold,
    color: colors.brand,
    includeFontPadding: false,
  },
});
