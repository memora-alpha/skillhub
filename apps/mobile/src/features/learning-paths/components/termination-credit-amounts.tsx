import { StyleSheet, Text, View } from "react-native";
import { Copy } from "@/components/feature-page";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function TerminationCreditAmounts({
  title,
  refund,
  counterpartyPayment,
  platformFee,
  compensationCredit,
  refundLabel = "Hoàn lại",
}: Readonly<{
  title: string;
  refund: string;
  counterpartyPayment: string;
  platformFee: string;
  compensationCredit?: string;
  refundLabel?: string;
}>) {
  const rows = [
    [refundLabel, refund],
    ["Chuyển đối tác", counterpartyPayment],
    ["Phí nền tảng", platformFee],
  ];
  return (
    <View style={styles.allocation}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {rows.map(([label, amount]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{`${label}:`}</Text>
          <Text selectable style={styles.amount}>
            {amount} CR
          </Text>
        </View>
      ))}
      {compensationCredit && !/^0(?:\.0+)?$/.test(compensationCredit) && (
        <Copy size="hint">
          Trong khoản chuyển có {compensationCredit} CR bồi hoàn theo kết luận
          vắng mặt.
        </Copy>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  allocation: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 12,
  },
  title: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 12,
    rowGap: 2,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
    flexGrow: 1,
  },
  amount: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flexShrink: 1,
  },
});
