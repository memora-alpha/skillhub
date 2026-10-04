import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";

export function BrandLogo({
  compact = false,
  size = "md",
}: {
  compact?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && styles.smallMark]}>
        <Text style={styles.initial}>S</Text>
      </View>
      <Text
        style={[
          styles.word,
          size === "sm" && { fontSize: 18 },
          compact && styles.smallWord,
        ]}
      >
        Skill<Text style={!compact && styles.accent}>Hub</Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    includeFontPadding: false,
    fontFamily: fonts.black,
    color: colors.white,
    fontSize: 14,
  },
  word: {
    includeFontPadding: false,
    fontFamily: fonts.displayBold,
    color: colors.ink,
    fontSize: 24,
  },
  accent: { color: colors.brand },
  smallMark: { width: 28, height: 28, borderRadius: 8 },
  smallWord: { fontSize: 16 },
});
