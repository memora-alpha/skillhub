import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  avatarSizes,
  fonts,
  iconSizes,
  toastTheme,
  typography,
} from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

export type ToastTone = "success" | "error" | "info";
const icons: Record<ToastTone, IconName> = {
  success: "check",
  error: "alert",
  info: "bell",
};
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
  const { width } = useWindowDimensions();
  const appearance = toastTheme.tones[tone];
  return (
    <View
      style={[
        styles.toast,
        { width: Math.min(width - toastTheme.gutter * 2, toastTheme.maxWidth) },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      aria-hidden={!visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View style={[styles.icon, { backgroundColor: appearance.background }]}>
        <Icon
          name={icons[tone]}
          color={appearance.foreground}
          size={iconSizes.control}
        />
      </View>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng thông báo"
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.close,
          pressed && { backgroundColor: toastTheme.closePressed },
        ]}
      >
        <Icon
          name="close"
          color={toastTheme.closeForeground}
          size={iconSizes.inline}
        />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  toast: {
    maxWidth: "100%",
    minHeight: toastTheme.minHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: toastTheme.gap,
    paddingLeft: toastTheme.padding,
    paddingVertical: toastTheme.padding,
    backgroundColor: toastTheme.surface,
    borderRadius: toastTheme.radius,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: toastTheme.border,
    boxShadow: toastTheme.shadow,
  },
  icon: {
    width: avatarSizes.compact,
    height: avatarSizes.compact,
    borderRadius: avatarSizes.compact / 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontFamily: fonts.semibold,
    ...typography.body,
    color: toastTheme.foreground,
    includeFontPadding: false,
  },
  close: {
    width: toastTheme.dismissSize,
    height: toastTheme.dismissSize,
    borderRadius: toastTheme.dismissSize / 2,
    marginRight: toastTheme.gutter / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
