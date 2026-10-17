import { StyleSheet, Text, View } from "react-native";
import { fonts, appColors } from "@/constants/theme";
import type { WalletSnapshot } from "../types/wallet";
import { formatCredit } from "../utils/amount";

export function WalletBalances({ snapshot }: { snapshot: WalletSnapshot }) {
  return (
    <View style={styles.stack}>
      {(
        [
          ["Khả dụng", snapshot.availableCredit],
          ["Đang tạm giữ", snapshot.heldCredit],
        ] as const
      ).map(([label, amount]) => (
        <View key={label} style={styles.stack}>
          <Text style={styles.label}>{label}</Text>
          <Text
            selectable
            accessibilityLabel={`${label}: ${formatCredit(amount)}`}
            style={styles.amount}
          >
            {formatCredit(amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12, minWidth: 0 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: appColors.muted,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 36,
    color: appColors.ink,
    flexShrink: 1,
  },
});
