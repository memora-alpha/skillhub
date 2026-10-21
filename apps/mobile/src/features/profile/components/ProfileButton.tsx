import type { ComponentProps } from "react";
import { Text } from "react-native";
import { Button } from "@/components/Button";
import { fonts } from "@/constants/theme";
import { profileColors } from "../constants/theme";

type Props = ComponentProps<typeof Button>;

const labelSize = {
  sm: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 14, lineHeight: 20 },
  lg: { fontSize: 16, lineHeight: 24 },
  xl: { fontSize: 18, lineHeight: 28 },
} as const;

export function ProfileButton({
  children,
  variant = "primary",
  size = "md",
  style,
  ...props
}: Props) {
  const backgroundColor =
    variant === "primary"
      ? profileColors.buttonPrimary
      : variant === "secondary"
        ? profileColors.buttonSecondary
        : undefined;
  const color =
    variant === "primary" || variant === "craft" || variant === "forest"
      ? "#FFFFFF"
      : variant === "white"
        ? profileColors.buttonPrimary
        : profileColors.buttonText;

  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      style={[
        {
          borderRadius: 6,
          backgroundColor,
          borderWidth: 0,
          borderColor: "transparent",
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text
          style={{
            color,
            fontFamily: fonts.semibold,
            textAlign: "center",
            includeFontPadding: false,
            ...labelSize[size],
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Button>
  );
}
