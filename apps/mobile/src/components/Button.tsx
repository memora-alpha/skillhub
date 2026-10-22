import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { appColors, appRadius, colors, fonts } from "@/constants/theme";

type ButtonVariant =
  "primary" | "secondary" | "ghost" | "white" | "craft" | "forest" | "paper";
type ButtonSize = "sm" | "md" | "lg" | "xl";
type ButtonProps = Readonly<{
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
  leadingIcon?: IconName;
  icon?: IconName;
}>;

const foregrounds: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: appColors.inkSoft,
  ghost: colors.inkSoft,
  white: colors.brand,
  craft: colors.white,
  forest: colors.white,
  paper: appColors.inkSoft,
};

const labelSizes: Record<ButtonSize, { fontSize: number; lineHeight: number }> =
  {
    sm: { fontSize: 14, lineHeight: 20 },
    md: { fontSize: 14, lineHeight: 20 },
    lg: { fontSize: 16, lineHeight: 24 },
    xl: { fontSize: 18, lineHeight: 28 },
  };

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  style,
  accessibilityLabel,
  disabled = false,
  leadingIcon,
  icon,
}: ButtonProps) {
  const foreground = foregrounds[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        sizes[size],
        style,
        pressed && !disabled && { opacity: 0.86 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {leadingIcon && (
        <Icon name={leadingIcon} size={18} color={foreground} filled={false} />
      )}
      {typeof children === "string" ? (
        <Text
          style={[styles.label, { color: foreground, ...labelSizes[size] }]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {icon && <Icon name={icon} size={18} color={foreground} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: appRadius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    flexShrink: 1,
    textAlign: "center",
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    lineHeight: 24,
  },
  primary: { backgroundColor: colors.brand },
  secondary: {
    backgroundColor: appColors.surfaceLow,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  ghost: { backgroundColor: "transparent" },
  white: { backgroundColor: colors.white },
  craft: { backgroundColor: appColors.primary },
  forest: { backgroundColor: appColors.forest },
  paper: {
    backgroundColor: appColors.surfaceLow,
    borderWidth: 1,
    borderColor: appColors.border,
  },
});
const sizes = StyleSheet.create({
  sm: { paddingHorizontal: 12, paddingVertical: 6 },
  md: { paddingHorizontal: 20, paddingVertical: 10 },
  lg: { paddingHorizontal: 24, paddingVertical: 12 },
  xl: { paddingHorizontal: 32, paddingVertical: 16 },
});
