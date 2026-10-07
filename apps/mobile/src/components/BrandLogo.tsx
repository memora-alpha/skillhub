import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, signedInChrome } from "@/constants/theme";

export function BrandLogo({
  compact = false,
  size = "md",
  markOnly = false,
  appearance = "default",
}: {
  compact?: boolean;
  size?: "sm" | "md";
  markOnly?: boolean;
  appearance?: "default" | "home";
}) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          compact && styles.smallMark,
          appearance === "home" && styles.homeMark,
        ]}
      >
        <Text
          style={[styles.initial, appearance === "home" && styles.homeInitial]}
        >
          S
        </Text>
      </View>
      {!markOnly && (
        <Text
          style={[
            styles.word,
            size === "sm" && { fontSize: 18 },
            compact && styles.smallWord,
            appearance === "home" && styles.homeWord,
          ]}
        >
          Skill
          <Text
            style={[
              !compact && styles.accent,
              appearance === "home" && styles.homeAccent,
            ]}
          >
            Hub
          </Text>
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  homeMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: signedInChrome.accent,
  },
  homeInitial: { fontFamily: fonts.displayBold, fontSize: 20 },
  homeWord: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: signedInChrome.ink,
  },
  homeAccent: { color: signedInChrome.accent },
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
