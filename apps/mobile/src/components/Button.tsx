import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { appColors, colors, fonts, layout } from "@/constants/theme";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "white"
  | "craft"
  | "forest"
  | "paper";
type ButtonSize = "sm" | "md" | "lg" | "xl";
type ButtonProps = Readonly<{
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
}>;

const foregrounds: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.inkSoft,
  ghost: colors.inkSoft,
  white: colors.brand,
  craft: colors.white,
  forest: colors.white,
  paper: appColors.forest,
};

const labelSizes: Record<ButtonSize, { fontSize: number; lineHeight: number }> = {
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
        (pressed || disabled) && { opacity: 0.75 },
      ]}
    >
      {typeof children === "string" ? (
        <Text
          style={[
            styles.label,
            { color: foreground, ...labelSizes[size] },
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: layout.radius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    lineHeight: 24,
  },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.sand },
  ghost: { backgroundColor: "transparent" },
  white: { backgroundColor: colors.white },
  craft: { backgroundColor: appColors.primary },
  forest: { backgroundColor: appColors.forest },
  paper: {
    backgroundColor: appColors.surfaceInset,
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
