import { StyleSheet, Text, View } from "react-native";
import { fonts, typography } from "@/constants/theme";
import { HistoryFilterControl } from "./history-filter-control";
import { paymentPalette as colors } from "./wallet-payment-palette";
import type { HistoryFilters as Selection } from "../types/transaction";
import { referenceLabel, transactionLabel } from "../utils/transaction-labels";

// SRS 6.7 / FR-CR-04..09: learning activity includes Hold, settlement,
// returns, teacher earnings and fees. It is not a charge for posting a request.
// Existing BE referenceType covers the whole Learning Path, without OR filters.
const categories: readonly {
  value: string;
  label: string;
  hint?: string;
  filters: Selection;
}[] = [
  {
    value: "all",
    label: "Tất cả",
    filters: {},
  },
  {
    value: "topup",
    label: "Nạp Credit",
    filters: { type: "TOP_UP" },
  },
  {
    value: "learning",
    label: "Học tập",
    hint: "Các giao dịch trong lộ trình học.",
    filters: { referenceType: "LEARNING_PATH" },
  },
];
export function HistoryFilters({
  filters,
  onChange,
}: {
  filters: Selection;
  onChange: (value: Selection) => void;
}) {
  const selected = categories.find(
    (category) =>
      category.filters.type === filters.type &&
      category.filters.referenceType === filters.referenceType,
  );
  const retainedLabel = [
    filters.type && transactionLabel(filters.type),
    filters.referenceType && referenceLabel(filters.referenceType),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.section}>
      <HistoryFilterControl
        label="Lọc lịch sử giao dịch"
        value={selected?.value ?? "retained"}
        options={[
          ...categories.map(({ value, label }) => ({ value, label })),
          ...(!selected ? [{ value: "retained", label: retainedLabel }] : []),
        ]}
        onChange={(value) => {
          const next = categories.find((category) => category.value === value);
          if (next && next !== selected) onChange({ ...next.filters });
        }}
      />
      {(!selected || selected.hint) && (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {selected?.hint ??
            "Đang áp dụng bộ lọc trước đó. Chọn một nhóm để thay đổi."}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  hint: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
});
