import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts } from "@/constants/theme";

export function HomeSection({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[homeStyles.section, style]}>{children}</View>;
}
export function SectionHeading({
  title,
  action,
  onPress,
  margin = 12,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  margin?: number;
}) {
  return (
    <View style={[homeStyles.row, { marginBottom: margin, gap: 12 }]}>
      <Text
        accessibilityRole="header"
        style={[homeStyles.heading, { flexShrink: 1 }]}
      >
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} — ${title}`}
          onPress={onPress}
          hitSlop={6}
        >
          <Text style={homeStyles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
export const homeStyles = StyleSheet.create({
  stack: { gap: 24 },
  section: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.ink,
    includeFontPadding: false,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.ink,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brand,
    includeFontPadding: false,
  },
});
