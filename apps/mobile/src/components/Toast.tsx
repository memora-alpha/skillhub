import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, typography } from "@/constants/theme";
import { Icon } from "./Icon";

export type ToastTone = "success" | "error" | "info";
export function ToastContent({
  message,
  tone,
  visible,
  onDismiss,
}: {
  message: string;
  tone: ToastTone;
  visible: boolean;
  onDismiss: () => void;
}) {
  const color =
    tone === "error"
      ? colors.error
      : tone === "success"
        ? colors.success
        : colors.brand;
  return (
    <View
      style={[styles.toast, { borderLeftColor: color }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      aria-hidden={!visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <Icon
        name={tone === "success" ? "check-circle" : "alert"}
        color={color}
        size={20}
      />
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng thông báo"
        onPress={onDismiss}
        style={styles.close}
      >
        <Icon name="close" color={colors.muted} size={18} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  toast: {
    width: "92%",
    maxWidth: 448,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    boxShadow: "0 4px 16px rgba(28, 20, 16, 0.12)",
  },
  message: {
    flex: 1,
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.inkSoft,
    includeFontPadding: false,
    paddingVertical: 6,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
