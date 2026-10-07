import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { typography, colors, fonts, radius } from "@/constants/theme";
import { Icon } from "./Icon";

export function FormNotice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const success = tone === "success";
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.notice, success ? styles.success : styles.error]}
    >
      <Icon
        name={success ? "check-circle" : "alert"}
        size={16}
        color={success ? colors.success : colors.error}
      />
      <Text style={[styles.label, { color: success ? colors.success : colors.error }]}>
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
  success: { borderColor: "#A3D4B9", backgroundColor: colors.successLight },
  label: {
    flex: 1,
    fontFamily: fonts.body,
    ...typography.body,
    includeFontPadding: false,
  },
});
