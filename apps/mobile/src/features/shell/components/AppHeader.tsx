import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius as radius,
  avatarSizes,
  iconSizes,
  fonts,
  signedInChrome,
} from "@/constants/theme";

type AppHeaderProps = Readonly<{
  profile: Readonly<{ name: string; userId?: string }>;
  onAction: (title: string) => void;
  onAccount: () => void;
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  backLabel?: string;
  appearance?: "default" | "home";
}>;

export function AppHeader({
  profile,
  onAction,
  onAccount,
  title,
  onBack,
  rightAction,
  backLabel = "Quay lại hồ sơ",
  appearance = "home",
}: AppHeaderProps) {
  const { width } = useWindowDimensions();
  const home = appearance === "home";
  return (
    <View
      style={[
        styles.header,
        home && styles.homeHeader,
        !!title && { gap: 8 },
        home && !!title && styles.homeTitledHeader,
      ]}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={{ padding: 6 }}
          hitSlop={6}
        >
          <View style={{ transform: [{ rotate: "180deg" }] }}>
            <Icon name="arrow" size={20} color={colors.muted} />
          </View>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SkillHub — trang chủ"
          onPress={() => onAction("Trang chủ")}
        >
          <BrandLogo
            size="sm"
            appearance={home ? "home" : "default"}
            markOnly={!!title && width < 480}
          />
        </Pressable>
      )}
      {title && (
        <Text
          style={[styles.title, home && styles.homeTitle, { flex: 1 }]}
          numberOfLines={width < 400 ? 2 : 1}
        >
          {title}
        </Text>
      )}
      {!title && <View style={{ flex: 1 }} />}
      <View style={styles.headerActions}>
        {width >= 640 && (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Tin nhắn"
            onPress={() => onAction("Tin nhắn")}
          >
            <Icon
              name="message"
              size={iconSizes.control}
              color={colors.muted}
            />
          </Pressable>
        )}
        <Pressable
          style={[styles.iconButton, home && styles.homeNotification]}
          accessibilityRole="button"
          accessibilityLabel="Thông báo — 3 thông báo"
          onPress={() => onAction("Thông báo")}
          hitSlop={6}
        >
          <Icon
            name="bell"
            size={iconSizes.control}
            color={home ? signedInChrome.accent : colors.muted}
          />
          <View style={[styles.count, home && styles.homeCount]}>
            <Text style={styles.countLabel}>3</Text>
          </View>
        </Pressable>
        {rightAction}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở menu tài khoản"
          onPress={onAccount}
          style={{ marginLeft: 4 }}
          hitSlop={6}
        >
          <Avatar
            name={profile.name}
            userId={profile.userId}
            size={avatarSizes.compact}
          />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  homeHeader: {
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderBottomWidth: 0,
    backgroundColor: signedInChrome.background,
  },
  homeTitledHeader: { paddingHorizontal: 16, gap: 6 },
  homeTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  homeNotification: {
    width: 36,
    height: 36,
    padding: 0,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: signedInChrome.border,
  },
  homeCount: {
    width: 14,
    height: 14,
    right: 2,
    top: 1,
    borderRadius: 7,
    backgroundColor: signedInChrome.accent,
  },
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 28,
    color: colors.ink,
    includeFontPadding: false,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { padding: 9, borderRadius: radius.control },
  count: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 9,
    lineHeight: 12,
    includeFontPadding: false,
  },
});
