import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appRadius, fonts, typography } from "@/constants/theme";
import { Icon } from "@/components/Icon";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentSurface({
  children,
  title,
  testID,
}: {
  children: ReactNode;
  title?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.surface}>
      {title && (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function PaymentMethod() {
  return (
    <View style={styles.method}>
      <View style={styles.methodIcon}>
        <Icon name="wallet" color={colors.brand} size={20} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={styles.methodTitle}>QR ngân hàng</Text>
        <Text style={styles.caption}>Thanh toán qua payOS</Text>
      </View>
      <Icon name="check-circle" color={colors.success} size={20} />
    </View>
  );
}
export const paymentSurfaceStyles = StyleSheet.create({
  hero: { alignItems: "center", gap: 8, paddingVertical: 20 },
  caption: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.muted,
    textAlign: "center",
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.amount,
    color: colors.brandDark,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  credit: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.success,
    backgroundColor: colors.successSoft,
    borderRadius: appRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "hidden",
    textAlign: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: "100%",
  },
});
const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 18,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.brandDark,
  },
  method: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  methodIcon: {
    backgroundColor: colors.brandSoft,
    borderRadius: appRadius.card,
    padding: 12,
  },
  methodCopy: { flex: 1, gap: 3 },
  methodTitle: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
});
