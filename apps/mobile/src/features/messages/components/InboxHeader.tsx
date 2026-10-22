import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, iconSizes, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export function InboxHeader({
  onOpenProposals,
  children,
}: Readonly<{ onOpenProposals: () => void; children?: ReactNode }>) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xem đề xuất nhận được và đã gửi"
        onPress={onOpenProposals}
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.72 }]}
      >
        <View style={styles.icon}>
          <Icon
            name="clipboard"
            size={iconSizes.control}
            color={colors.orange}
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Đề xuất của bạn</Text>
          <Text style={styles.subtitle}>Nhận được và đã gửi</Text>
        </View>
        <View style={styles.action}>
          <Text style={styles.actionText}>Xem</Text>
          <Icon name="chevron" size={iconSizes.inline} color={colors.orange} />
        </View>
      </Pressable>
      {children}
      <Text accessibilityRole="header" style={styles.section}>
        Cuộc trò chuyện
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, paddingBottom: 10 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    padding: 12,
    backgroundColor: colors.orangePale,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: appRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeSoft,
  },
  content: { flex: 1, minWidth: 0 },
  title: { ...typography.secondary, fontFamily: fonts.bold, color: colors.ink },
  subtitle: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.orange,
  },
  section: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.muted,
    marginTop: 4,
  },
});
