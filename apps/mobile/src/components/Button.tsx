import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts, layout } from "@/constants/theme";

type ButtonProps = {
  children: ReactNode;
  onPress: () => void;
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "white"
    | "craft"
    | "forest"
    | "paper";
  size?: "sm" | "md" | "lg" | "xl";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
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
  const foreground =
    variant === "primary" || variant === "craft" || variant === "forest"
      ? colors.white
      : variant === "paper"
        ? "#264E3F"
      : variant === "white"
        ? colors.brand
        : colors.inkSoft;
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
            {
              color: foreground,
              fontSize: size === "xl" ? 18 : size === "lg" ? 16 : 14,
              lineHeight: size === "xl" ? 28 : size === "lg" ? 24 : 20,
            },
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
  craft: { backgroundColor: "#BA4E36" },
  forest: { backgroundColor: "#264E3F" },
  paper: {
    backgroundColor: "#EDE8DF",
    borderWidth: 1,
    borderColor: "#E2DCD2",
  },
});
const sizes = StyleSheet.create({
  sm: { paddingHorizontal: 12, paddingVertical: 6 },
  md: { paddingHorizontal: 20, paddingVertical: 10 },
  lg: { paddingHorizontal: 24, paddingVertical: 12 },
  xl: { paddingHorizontal: 32, paddingVertical: 16 },
});
