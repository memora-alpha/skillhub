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
import { colors, fonts } from "@/constants/theme";

export function ProfileCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[profileStyles.card, style]}>{children}</View>;
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
      <Icon name="shield" size={10} color={colors.sage} />
      <Text style={styles.badgeText}>Xác minh</Text>
    </View>
  );
}
export const profileStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.ink,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22.75,
    color: colors.body,
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
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: colors.sageLight,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.sage,
    includeFontPadding: false,
  },
});
