import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import type { AccountSession } from "@/features/auth";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function SettingsAccountCard({
  session,
  disabled,
  onPress,
}: Readonly<{
  session: AccountSession;
  disabled: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Xem thông tin tài khoản"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <Avatar
        name={session.name}
        userId={session.userId}
        sourceUri={session.avatarUrl}
        size={52}
      />
      <View style={styles.copy}>
        <Text style={styles.name}>{session.name}</Text>
        <Text style={styles.email}>{session.email}</Text>
        <View style={styles.link}>
          <Text style={styles.linkText}>Thông tin tài khoản</Text>
          <Icon name="chevron" size={12} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  email: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  link: { flexDirection: "row", alignItems: "center", gap: 2, paddingTop: 2 },
  linkText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
});
