import { StyleSheet, Text, View } from "react-native";
import {
  typography,
  appColors as colors,
  appRadius as radius,
  fonts,
} from "@/constants/theme";

const variants = {
  default: { background: colors.surfaceInset, foreground: colors.body },
  success: { background: colors.successSoft, foreground: colors.success },
  warning: { background: colors.amberSoft, foreground: colors.amber },
  sage: { background: colors.forestSoft, foreground: colors.forest },
};
export function Badge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: keyof typeof variants;
}) {
  const tint = variants[variant];
  return (
    <View style={[styles.badge, { backgroundColor: tint.background }]}>
      <Text style={[styles.text, { color: tint.foreground }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.badge,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  text: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    includeFontPadding: false,
  },
});
