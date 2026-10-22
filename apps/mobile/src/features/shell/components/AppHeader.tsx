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
import { useNotificationCount } from "@/features/notifications/state";
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
  titleContent?: ReactNode;
  centeredTitle?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  backLabel?: string;
  appearance?: "default" | "home";
  chromeColors?: Readonly<{
    background?: string;
    border?: string;
    accent?: string;
  }>;
  navigationBlocked?: boolean;
}>;

export function AppHeader({
  profile,
  onAction,
  onAccount,
  title,
  titleContent,
  centeredTitle = false,
  onBack,
  rightAction,
  backLabel = "Quay lại hồ sơ",
  appearance = "home",
  chromeColors,
  navigationBlocked = false,
}: AppHeaderProps) {
  const { width } = useWindowDimensions();
  const notifications = useNotificationCount();
  const unread = notifications.data ?? 0;
  const home = appearance === "home";
  const chrome = { ...signedInChrome, ...chromeColors };
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
        home && { backgroundColor: chrome.background },
        !!title && { gap: 8 },
        home && !!title && styles.homeTitledHeader,
        centeredTitle && styles.centeredHeader,
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
      {titleContent != null ? (
        <View style={styles.titleContent}>{titleContent}</View>
      ) : title && centeredTitle ? (
        <View pointerEvents="none" style={styles.centerTitleBlock}>
          <Text style={styles.centerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : title ? (
        <Text
          style={[styles.title, home && styles.homeTitle, { flex: 1 }]}
          numberOfLines={width < 400 ? 2 : 1}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {centeredTitle && titleContent == null && !!title && (
        <View style={{ flex: 1 }} />
      )}
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
            style={[
              styles.iconButton,
              home && styles.homeNotification,
              home && { borderColor: chrome.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              unread
                ? `Thông báo — ${unread > 99 ? "hơn 99" : unread} thông báo chưa đọc`
                : "Mở thông báo"
            }
            {...navigationState}
            onPress={() => onAction("Thông báo")}
            hitSlop={6}
          >
            <Icon
              name="bell"
              size={iconSizes.control}
              color={home ? chrome.accent : colors.muted}
            />
            {unread > 0 && (
              <View style={styles.count}>
                <Text style={styles.countText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
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
  centeredHeader: { minHeight: 64, paddingVertical: 6 },
  centerTitleBlock: {
    position: "absolute",
    left: 52,
    right: 52,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  centerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    includeFontPadding: false,
    textAlign: "center",
  },
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
  titleContent: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { padding: 9, borderRadius: radius.control },
  countText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
    color: colors.white,
  },
  count: {
    position: "absolute",
    right: -4,
    top: -7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
