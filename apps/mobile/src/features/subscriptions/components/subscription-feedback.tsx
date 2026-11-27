import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { appColors, fonts, typography } from "@/constants/theme";

export function SubscriptionFeedback({
  children,
  tone = "error",
}: Readonly<{
  children: ReactNode;
  tone?: "error" | "info";
}>) {
  return (
    <Text
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.text,
        { color: appColors[tone === "error" ? "error" : "muted"] },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.body, ...typography.secondary },
});
