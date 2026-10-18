import { Pressable, StyleSheet, Text, View } from "react-native";
import { WalletField } from "./wallet-ui";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { formatCredit } from "../utils/amount";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
} from "../utils/transaction-labels";
import type { Transaction } from "../types/transaction";

export function RecordedMovement({ row }: { row: Transaction }) {
  return (
    <View style={styles.movement}>
      <WalletField
        label="Thay đổi khả dụng"
        value={formatCredit(row.availableDelta, { signed: true })}
      />
      <WalletField
        label="Thay đổi tạm giữ"
        value={formatCredit(row.heldDelta, { signed: true })}
      />
      <WalletField
        label="Khả dụng sau giao dịch"
        value={formatCredit(row.availableAfter)}
      />
      <WalletField
        label="Tạm giữ sau giao dịch"
        value={formatCredit(row.heldAfter)}
      />
    </View>
  );
}
export function TransactionRow({
  row,
  onOpen,
  position = "only",
}: {
  row: Transaction;
  onOpen: () => void;
  position?: "first" | "middle" | "last" | "only";
}) {
  const positive =
    row.availableDelta !== "0.00" && !row.availableDelta.startsWith("-");
  const negative = row.availableDelta.startsWith("-");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem giao dịch ${row.id}: ${transactionLabel(row.type)}, ${transactionStatus(row.status)}, ${formatCredit(row.amount)}, ${transactionTime(row.createdAt)}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        (position === "first" || position === "only") && styles.first,
        (position === "last" || position === "only") && styles.last,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Icon
          name={
            row.type === "TOP_UP"
              ? "plus"
              : row.type === "HOLD"
                ? "lock"
                : "wallet"
          }
          color={colors.forest}
          size={20}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.line}>
          <Text style={styles.title}>{transactionLabel(row.type)}</Text>
          <Text style={styles.amount}>{formatCredit(row.amount)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.caption}>{transactionTime(row.createdAt)}</Text>
          <View
            style={[styles.status, row.status === "SUCCESS" && styles.recorded]}
          >
            <Text
              style={[
                styles.statusLabel,
                row.status === "SUCCESS" && styles.recordedLabel,
              ]}
            >
              {transactionStatus(row.status)}
            </Text>
          </View>
        </View>
        <View style={styles.deltas}>
          <Text
            style={[
              styles.delta,
              positive && styles.increase,
              negative && styles.decrease,
            ]}
          >
            Khả dụng {formatCredit(row.availableDelta, { signed: true })}
          </Text>
          {row.heldDelta !== "0.00" && (
            <Text style={styles.delta}>
              Tạm giữ {formatCredit(row.heldDelta, { signed: true })}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 88,
  },
  first: {
    borderTopLeftRadius: appRadius.card,
    borderTopRightRadius: appRadius.card,
  },
  last: {
    borderBottomLeftRadius: appRadius.card,
    borderBottomRightRadius: appRadius.card,
    borderBottomWidth: 0,
  },
  icon: {
    padding: 10,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  content: { flex: 1, minWidth: 0, gap: 8 },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
    flexShrink: 1,
  },
  amount: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceLow,
  },
  statusLabel: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.body,
  },
  recorded: { backgroundColor: colors.successSoft },
  recordedLabel: { color: colors.success },
  deltas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  delta: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.body,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  increase: { color: colors.forest, backgroundColor: colors.forestSoft },
  decrease: { color: colors.primaryDark, backgroundColor: colors.primarySoft },
  movement: { gap: 4 },
  pressed: { opacity: 0.7 },
});
