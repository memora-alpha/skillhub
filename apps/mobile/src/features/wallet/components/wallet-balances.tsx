import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  fonts,
  appColors as colors,
  appRadius,
  typography,
} from "@/constants/theme";
import type { WalletSnapshot } from "../types/wallet";
import { formatCredit } from "../utils/amount";

export function WalletBalances({ snapshot }: { snapshot: WalletSnapshot }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="wallet" color={colors.primaryDark} size={24} />
        <Text style={styles.label}>Số dư khả dụng</Text>
      </View>
      <Text
        selectable
        accessibilityLabel={`Khả dụng: ${formatCredit(snapshot.availableCredit)}`}
        style={styles.amount}
      >
        {formatCredit(snapshot.availableCredit)}
      </Text>
      <View style={styles.held}>
        <View style={styles.header}>
          <Icon name="lock" color={colors.primaryDark} size={16} />
          <Text style={styles.label}>Đang tạm giữ</Text>
        </View>
        <Text
          selectable
          accessibilityLabel={`Đang tạm giữ: ${formatCredit(snapshot.heldCredit)}`}
          style={styles.heldAmount}
        >
          {formatCredit(snapshot.heldCredit)}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: appRadius.feature,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    gap: 8,
    minWidth: 0,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
    flexShrink: 1,
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.primaryDark,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  held: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryMuted,
    paddingTop: 16,
    marginTop: 12,
    gap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  heldAmount: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
});
