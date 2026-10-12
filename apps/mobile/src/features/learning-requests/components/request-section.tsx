import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";

export function RequestSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    padding: 18,
    gap: 14,
    borderRadius: appRadius.card,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: appColors.ink,
  },
});
