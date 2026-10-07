import { useEffect } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { accountItems } from "@/constants/navigation";
import {
  appColors as colors,
  appRadius as radius,
  fonts,
  iconSizes,
} from "@/constants/theme";

export function AccountMenu({
  visible,
  profile,
  onClose,
  onAction,
  onLogout,
}: Readonly<{
  visible: boolean;
  profile: Readonly<{ name: string; email: string }>;
  onClose: () => void;
  onAction: (title: string) => void;
  onLogout: () => void;
}>) {
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
  // Keep the account menu in the screen so dialogs never overlap native modals.
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
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

const styles = StyleSheet.create({
  overlay: { zIndex: 50, elevation: 20 },
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
});
