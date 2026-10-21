import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useNotifications } from "@/features/notifications/state";
import {
  appColors as colors,
  appRadius as radius,
  avatarSizes,
  iconSizes,
  fonts,
  signedInChrome,
} from "@/constants/theme";

type AppHeaderProps = Readonly<{
  profile: Readonly<{
    name: string;
    userId?: string;
    avatarUrl?: string | null;
  }>;
  onAction: (title: string) => void;
  onAccount: () => void;
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  backLabel?: string;
  appearance?: "default" | "home";
  navigationBlocked?: boolean;
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
  navigationBlocked = false,
}: AppHeaderProps) {
  const { width } = useWindowDimensions();
  const notifications = useNotifications();
  const unread = notifications.items.some((item) => !item.readAt);
  const home = appearance === "home";
  const compact = Platform.OS !== "web" || width < 640;
  const navigationState = {
    disabled: navigationBlocked,
    accessibilityState: { disabled: navigationBlocked },
  };
  return (
    <View
      style={[
        styles.header,
        home && styles.homeHeader,
        !!title && { gap: 8 },
        home && !!title && styles.homeTitledHeader,
      ]}
    >
      <HeaderLeading
        onBack={onBack}
        backLabel={backLabel}
        onAction={onAction}
        navigationBlocked={navigationBlocked}
        compact={compact}
        title={title}
        home={home}
        width={width}
      />
      {!!title && (
        <Text
          style={[styles.title, home && styles.homeTitle, { flex: 1 }]}
          numberOfLines={width < 400 ? 2 : 1}
        >
          {title}
        </Text>
      )}
      {!title && <View style={{ flex: 1 }} />}
      <View style={styles.headerActions}>
        {!compact && (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Tin nhắn"
            {...navigationState}
            onPress={() => onAction("Tin nhắn")}
          >
            <Icon
              name="message"
              size={iconSizes.control}
              color={colors.muted}
            />
          </Pressable>
        )}
        {!onBack && (
          <Pressable
            style={[styles.iconButton, home && styles.homeNotification]}
            accessibilityRole="button"
            accessibilityLabel={
              unread
                ? "Thông báo — có mục chưa đọc trong danh sách đã tải"
                : "Mở thông báo"
            }
            {...navigationState}
            onPress={() => onAction("Thông báo")}
            hitSlop={6}
          >
            <Icon
              name="bell"
              size={iconSizes.control}
              color={home ? signedInChrome.accent : colors.muted}
            />
            {unread && (
              <View style={[styles.count, home && styles.homeCount]} />
            )}
          </Pressable>
        )}
        {rightAction}
        {!compact && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở menu tài khoản"
            {...navigationState}
            onPress={onAccount}
            style={{ marginLeft: 4 }}
            hitSlop={6}
          >
            <Avatar
              name={profile.name}
              userId={profile.userId}
              size={avatarSizes.compact}
              sourceUri={profile.avatarUrl}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
function HeaderLeading({
  onBack,
  backLabel,
  onAction,
  navigationBlocked,
  compact,
  title,
  home,
  width,
}: Readonly<
  Pick<
    AppHeaderProps,
    "onBack" | "onAction" | "navigationBlocked" | "title"
  > & { backLabel: string; compact: boolean; home: boolean; width: number }
>) {
  const navigationState = {
    disabled: navigationBlocked,
    accessibilityState: { disabled: navigationBlocked },
  };
  if (onBack)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        {...navigationState}
        onPress={onBack}
        style={{ padding: 6, opacity: navigationBlocked ? 0.5 : 1 }}
        hitSlop={6}
      >
        <View style={{ transform: [{ rotate: "180deg" }] }}>
          <Icon name="arrow" size={20} color={colors.muted} />
        </View>
      </Pressable>
    );
  if (compact && title) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SkillHub — trang chủ"
      {...navigationState}
      onPress={() => onAction("Trang chủ")}
    >
      <BrandLogo
        size="sm"
        appearance={home ? "home" : "default"}
        markOnly={!!title && width < 480}
      />
    </Pressable>
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
});
