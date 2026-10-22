import { StyleSheet, Text, View } from "react-native";
import { fonts, typography } from "@/constants/theme";
import type { Transaction } from "../types/transaction";
import { formatCredit } from "../utils/amount";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
} from "../utils/transaction-labels";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function TransactionReceipt({ row }: { row: Transaction }) {
  return (
    <View style={styles.receipt} testID="wallet-transaction-receipt">
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          {transactionLabel(row.type)}
        </Text>
        <Text selectable style={styles.amount}>
          {formatCredit(row.amount)}
        </Text>
        <Text
          style={[
            styles.status,
            row.status === "SUCCESS" && styles.success,
            row.status === "PENDING" && styles.pending,
            row.status === "FAILED" && styles.failed,
          ]}
        >
          {transactionStatus(row.status)}
        </Text>
      </View>
      <View style={styles.details}>
        <ReceiptField
          label="Thời gian"
          value={transactionTime(row.createdAt)}
        />
        <ReceiptField label="Mã giao dịch" value={row.id} identifier />
        {row.reversesTransactionId && (
          <ReceiptField
            label="Giao dịch gốc"
            value={row.reversesTransactionId}
            identifier
          />
        )}
      </View>
    </View>
  );
}

function ReceiptField({
  label,
  value,
  identifier,
}: {
  label: string;
  value: string;
  identifier?: boolean;
}) {
  return (
    <View style={[styles.field, identifier && styles.identifier]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        selectable
        style={[styles.value, identifier && styles.identifierValue]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { backgroundColor: colors.surface },
  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.body,
    textAlign: "center",
  },
  amount: {
    fontFamily: fonts.bold,
    ...typography.amount,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  status: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
    textAlign: "center",
  },
  success: { color: colors.success },
  pending: { color: colors.warning },
  failed: { color: colors.error },
  details: { paddingHorizontal: 20 },
  field: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: 16,
    rowGap: 8,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  identifier: { flexDirection: "column", alignItems: "stretch" },
  label: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  value: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
    marginLeft: "auto",
    textAlign: "right",
  },
  identifierValue: { marginLeft: 0, textAlign: "left" },
});
