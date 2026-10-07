import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { accountItems, appTabs } from "@/constants/navigation";

export function AppHeader({
  profile,
  onAction,
  onAccount,
  title,
  onBack,
  rightAction,
  backLabel = "Quay lại hồ sơ",
  appearance = "home",
}: {
  profile: { name: string; userId?: string };
  onAction: (title: string) => void;
  onAccount: () => void;
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  backLabel?: string;
  appearance?: "default" | "home";
}) {
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
            <Icon name="message" size={iconSizes.control} color={colors.muted} />
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
            <Text style={styles.countLabel}>
              3
            </Text>
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
export function AppNavigation({
  onAction,
  selected = "Trang chủ",
}: {
  onAction: (title: string) => void;
  selected?: string;
}) {
  return (
    <View style={styles.nav}>
      {appTabs.map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.label === selected }}
          aria-selected={tab.label === selected}
          onPress={() => onAction(tab.label)}
          style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.tabIcon}>
            <Icon
              name={tab.icon}
              size={iconSizes.navigation}
              color={
                tab.label === selected
                  ? signedInChrome.accent
                  : signedInChrome.muted
              }
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              { color: signedInChrome.muted },
              tab.label === selected && { color: signedInChrome.accent },
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function AccountMenu({
  visible,
  profile,
  onClose,
  onAction,
  onLogout,
}: {
  visible: boolean;
  profile: { name: string; email: string };
  onClose: () => void;
  onAction: (title: string) => void;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, onClose]);
  if (!visible) return null;
  // Keep the account menu in the screen so opening a dialog never overlaps two native modals.
  return (
    <View style={[StyleSheet.absoluteFill, styles.menuOverlay]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Đóng menu tài khoản"
        onPress={onClose}
      />
      <View
        accessibilityViewIsModal
        role="dialog"
        aria-modal
        accessibilityLabel="Menu tài khoản"
        style={[styles.menu, { top: insets.top + 56 }]}
      >
        <View style={styles.profile}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {profile.email}
          </Text>
        </View>
        {accountItems.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onAction(item.label);
            }}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { backgroundColor: colors.canvas },
            ]}
          >
            <Icon name={item.icon} size={iconSizes.control} color={colors.muted} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </Pressable>
        ))}
        <View style={styles.logout}>
          <Pressable
            accessibilityRole="button"
            onPress={onLogout}
            style={styles.menuItem}
          >
            <Icon name="logout" size={iconSizes.control} color={colors.error} />
            <Text style={[styles.menuLabel, { color: colors.error }]}>
              Đăng xuất
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
export function HomeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.searchField}>
      <Icon name="search" color={colors.muted} size={18} />
      <TextInput
        accessibilityLabel="Tìm kỹ năng trong dữ liệu demo"
        value={value}
        onChangeText={onChange}
        placeholder="Tìm kỹ năng..."
        placeholderTextColor={colors.mutedLight}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
      />
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
  nav: {
    flexDirection: "row",
    width: "100%",
    minHeight: 64,
    maxWidth: 1024,
    alignSelf: "center",
    borderTopWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: signedInChrome.surface,
    boxShadow: "0 -2px 12px rgba(53, 43, 31, 0.03)",
  },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
  },
  tabIcon: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  menu: {
    position: "absolute",
    right: 16,
    width: 224,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  menuOverlay: { zIndex: 50, elevation: 20 },
  profile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  email: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.body,
    includeFontPadding: false,
  },
  logout: {
    borderTopWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    paddingTop: 4,
  },
  searchField: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
});
