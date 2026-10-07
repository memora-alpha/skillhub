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
  signedInChrome,
} from "@/constants/theme";

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
      <Icon name="shield" size={iconSizes.inline} color="#24956C" />
      <Text style={styles.badgeText}>Xác minh</Text>
    </View>
  );
}
export const profileStyles = StyleSheet.create({
  section: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: signedInChrome.surface,
    boxShadow: "0 2px 8px rgba(53, 43, 31, 0.04)",
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
    color: signedInChrome.ink,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.medium,
    ...typography.body,
    color: signedInChrome.ink,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: "#5A5550",
    includeFontPadding: false,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: "#8D8881",
    includeFontPadding: false,
  },
  link: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: "#EF653D",
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
    backgroundColor: "#E7F8F1",
  },
  badgeText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: "#24956C",
    includeFontPadding: false,
  },
});
