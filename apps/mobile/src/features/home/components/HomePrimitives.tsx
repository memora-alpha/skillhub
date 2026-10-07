import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { iconSizes, typography, fonts } from "@/constants/theme";
import { Icon } from "@/components/Icon";
import { homeColors as colors } from "../constants/theme";

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
  accent = colors.orange,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  margin?: number;
  accent?: string;
}) {
  return (
    <View style={[homeStyles.row, { marginBottom: margin, gap: 12 }]}>
      <View style={homeStyles.sectionTitle}>
        <View style={[homeStyles.sectionAccent, { backgroundColor: accent }]} />
        <Text accessibilityRole="header" style={homeStyles.heading}>
          {title}
        </Text>
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} — ${title}`}
          onPress={onPress}
          hitSlop={6}
          style={homeStyles.sectionAction}
        >
          <Text style={homeStyles.link}>{action}</Text>
          <Icon name="chevron" size={iconSizes.inline} color={colors.orange} />
        </Pressable>
      )}
    </View>
  );
}
export const homeStyles = StyleSheet.create({
  stack: { gap: 28 },
  section: { gap: 0 },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionAccent: { width: 4, height: 16, borderRadius: 2 },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    includeFontPadding: false,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
    includeFontPadding: false,
  },
  link: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.orange,
    includeFontPadding: false,
  },
});
