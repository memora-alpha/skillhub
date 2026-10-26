import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { typography, colors, fonts, radius } from "@/constants/theme";
import { Icon } from "./Icon";

export function FormNotice({
  tone,
  children,
  compact = false,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
  compact?: boolean;
}) {
  const success = tone === "success";
  const info = tone === "info";
  const foreground = success
    ? colors.success
    : info
      ? colors.inkSoft
      : colors.error;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        compact && styles.compact,
        success ? styles.success : info ? styles.info : styles.error,
      ]}
    >
      <Icon
        name={success ? "check-circle" : "alert"}
        size={16}
        color={foreground}
      />
      <Text
        style={[styles.label, compact && styles.hint, { color: foreground }]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.control,
  },
  error: { borderColor: "#F0A0A0", backgroundColor: colors.errorLight },
  compact: { padding: 10, gap: 8 },
  hint: { ...typography.secondary },
  success: { borderColor: "#A3D4B9", backgroundColor: colors.successLight },
  info: { borderColor: colors.border, backgroundColor: colors.sand },
  label: {
    flex: 1,
    fontFamily: fonts.body,
    ...typography.body,
    includeFontPadding: false,
  },
});
