import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  typography,
  iconSizes,
  fonts,
} from "@/constants/theme";
import { profileColors, profileShadows } from "../constants/theme";

export function ProfileSection({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[profileStyles.section, style]}>{children}</View>;
}
export function ProfileHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={profileStyles.headingRow}>
      <Text accessibilityRole="header" style={profileStyles.heading}>
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} — ${title}`}
          onPress={onPress}
          hitSlop={6}
        >
          <Text style={profileStyles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function VerifiedBadge() {
  return (
    <View style={styles.badge}>
      <Icon
        name="shield"
        size={iconSizes.inline}
        color={profileColors.verified}
      />
      <Text style={styles.badgeText}>Xác minh</Text>
    </View>
  );
}
export const profileStyles = StyleSheet.create({
  section: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: profileColors.border,
    backgroundColor: profileColors.surface,
    boxShadow: profileShadows.section,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  heading: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: profileColors.ink,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.medium,
    ...typography.body,
    color: profileColors.ink,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: profileColors.body,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: profileColors.muted,
    includeFontPadding: false,
  },
  link: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: profileColors.accent,
    includeFontPadding: false,
  },
});
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: profileColors.verifiedSoft,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.verified,
    includeFontPadding: false,
  },
});
