import { Pressable, Text, View } from "react-native";
import { Panel, Copy, ui } from "@/components/feature-page";
import { appColors } from "@/constants/theme";
import { formatCredit } from "../utils/amount";
import {
  transactionLabel,
  transactionStatus,
  transactionTime,
} from "../utils/transaction-labels";
import type { Transaction } from "../types/transaction";

export function RecordedMovement({ row }: { row: Transaction }) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={ui.copy}>
        Số Credit: {formatCredit(row.amount)}
      </Text>
      <Text selectable style={ui.copy}>
        Thay đổi khả dụng: {formatCredit(row.availableDelta, { signed: true })}
      </Text>
      <Text selectable style={ui.copy}>
        Thay đổi tạm giữ: {formatCredit(row.heldDelta, { signed: true })}
      </Text>
      <Text selectable style={ui.copy}>
        Khả dụng sau giao dịch: {formatCredit(row.availableAfter)}
      </Text>
      <Text selectable style={ui.copy}>
        Tạm giữ sau giao dịch: {formatCredit(row.heldAfter)}
      </Text>
    </View>
  );
}
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
      accessibilityLabel={`Xem giao dịch ${row.id}: ${transactionLabel(row.type)}, ${transactionStatus(row.status)}, ${formatCredit(row.amount)}, ${transactionTime(row.createdAt)}`}
      onPress={onOpen}
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1,
        borderColor: appColors.muted,
      })}
    >
      <Panel title={transactionLabel(row.type)}>
        <Copy>
          {transactionStatus(row.status)} · {transactionTime(row.createdAt)}
        </Copy>
        <RecordedMovement row={row} />
        <Copy muted>{row.id}</Copy>
      </Panel>
    </Pressable>
  );
}
