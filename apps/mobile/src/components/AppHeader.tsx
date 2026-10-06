import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  BackHandler,
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
import { colors, fonts } from "@/constants/theme";
import type { MockSession } from "@/features/auth/context/MockSession";
import { accountItems, appTabs } from "@/constants/navigation";

export function AppHeader({
  profile,
  onAction,
  onAccount,
  title,
  onBack,
  rightAction,
  backLabel = "Quay lại hồ sơ",
}: {
  profile: MockSession;
  onAction: (title: string) => void;
  onAccount: () => void;
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  backLabel?: string;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.header, !!title && { gap: 8 }]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={{ padding: 6 }}
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
          <BrandLogo size="sm" markOnly={!!title && width < 480} />
        </Pressable>
      )}
      {title && (
        <Text
          style={[styles.title, { flex: 1 }]}
          numberOfLines={width < 400 ? 2 : 1}
        >
          {title}
        </Text>
      )}
      {!title && <View style={{ flex: 1 }} />}
      {width >= 768 && (
        <Pressable
          onPress={() => onAction("Tìm kiếm")}
          accessibilityRole="button"
          accessibilityLabel="Tìm kỹ năng, người dùng"
          style={styles.search}
        >
          <Icon name="search" color={colors.muted} size={16} />
          <Text style={styles.searchText}>Tìm kỹ năng, người dùng...</Text>
        </Pressable>
      )}
      <View style={styles.headerActions}>
        {width < 768 && !(rightAction && width < 380) && (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm"
            onPress={() => onAction("Tìm kiếm")}
          >
            <Icon name="search" size={18} color={colors.muted} />
          </Pressable>
        )}
        {width >= 640 && (
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Tin nhắn"
            onPress={() => onAction("Tin nhắn")}
          >
            <Icon name="message" size={18} color={colors.muted} />
          </Pressable>
        )}
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Thông báo — 3 thông báo"
          onPress={() => onAction("Thông báo")}
        >
          <Icon name="bell" size={18} color={colors.muted} />
          <View style={styles.count}>
            <Text style={styles.countLabel}>3</Text>
          </View>
        </Pressable>
        {rightAction}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở menu tài khoản"
          onPress={onAccount}
          style={{ marginLeft: 4 }}
        >
          <Avatar name={profile.name} size={32} />
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
          accessibilityState={{ selected: tab.label === selected }}
          aria-selected={tab.label === selected}
          onPress={() => onAction(tab.label)}
          style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
        >
          <Icon
            name={tab.icon}
            size={20}
            color={tab.label === selected ? colors.brand : colors.muted}
          />
          <Text
            style={[
              styles.tabLabel,
              tab.label === selected && { color: colors.brand },
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
  profile: MockSession;
  onClose: () => void;
  onAction: (title: string) => void;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
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
              pressed && { backgroundColor: colors.cream },
            ]}
          >
            <Icon name={item.icon} size={16} color={colors.muted} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </Pressable>
        ))}
        <View style={styles.logout}>
          <Pressable
            accessibilityRole="button"
            onPress={onLogout}
            style={styles.menuItem}
          >
            <Icon name="logout" size={16} color={colors.error} />
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
  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: colors.white,
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
  iconButton: { padding: 8, borderRadius: 12 },
  count: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
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
  search: {
    width: 256,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.mutedLight,
    includeFontPadding: false,
  },
  nav: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 10 },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
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
    backgroundColor: colors.white,
    borderRadius: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 12,
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
    color: colors.inkSoft,
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
    backgroundColor: colors.cream,
    borderRadius: 12,
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
