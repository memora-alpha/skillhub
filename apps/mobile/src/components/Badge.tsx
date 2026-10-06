import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";

const variants = {
  default: { background: colors.sand, foreground: colors.body },
  success: { background: colors.successLight, foreground: colors.success },
  warning: { background: colors.warningLight, foreground: colors.warning },
  sage: { background: colors.sageLight, foreground: colors.sage },
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
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
