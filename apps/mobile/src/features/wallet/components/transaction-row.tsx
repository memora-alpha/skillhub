import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";
import { formatCredit } from "../utils/amount";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
} from "../utils/transaction-labels";
import type { Transaction } from "../types/transaction";

export function TransactionRow({
  row,
  onOpen,
}: {
  row: Transaction;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${transactionLabel(row.type)}, ${formatCredit(row.amount)}, ${transactionStatus(row.status)}, ${transactionTime(row.createdAt)}`}
      accessibilityHint="Xem chi tiết giao dịch"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <Text style={styles.title}>{transactionLabel(row.type)}</Text>
        <Text style={styles.amount}>{formatCredit(row.amount)}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.time}>{transactionTime(row.createdAt)}</Text>
        {row.status !== "SUCCESS" && (
          <Text
            style={[
              styles.status,
              row.status === "PENDING" && styles.pending,
              row.status === "FAILED" && styles.failed,
            ]}
          >
            {transactionStatus(row.status)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 80,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 4,
  },
  title: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    flexShrink: 1,
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
    marginLeft: "auto",
    textAlign: "right",
  },
  time: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.body,
    fontVariant: ["tabular-nums"],
  },
  status: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.body,
    marginLeft: "auto",
    flexShrink: 1,
    textAlign: "right",
  },
  pending: { color: colors.warning },
  failed: { color: colors.error },
  pressed: { backgroundColor: colors.surfaceLow },
});
