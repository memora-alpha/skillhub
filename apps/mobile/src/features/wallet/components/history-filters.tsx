import { StyleSheet, Text, View } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { HistoryFilterControl } from "./history-filter-control";
import type { HistoryFilters as Selection } from "../types/transaction";
import { referenceLabel, transactionLabel } from "../utils/transaction-labels";

// SRS 6.7 / FR-CR-04..09: learning activity includes Hold, settlement,
// returns, teacher earnings and fees. It is not a charge for posting a request.
// Existing BE referenceType covers the whole Learning Path, without OR filters.
const categories: readonly {
  value: string;
  label: string;
  hint: string;
  filters: Selection;
}[] = [
  {
    value: "all",
    label: "Tất cả giao dịch",
    hint: "Các giao dịch Credit đã được ghi nhận trong ví.",
    filters: {},
  },
  {
    value: "topup",
    label: "Nạp Credit",
    hint: "Các khoản nạp Credit đã được ghi nhận vào ví.",
    filters: { type: "TOP_UP" },
  },
  {
    value: "learning",
    label: "Giao dịch học tập",
    hint: "Tạm giữ, thanh toán, thu nhập, hoàn Credit và phí của lộ trình học.",
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
      <Text accessibilityLiveRegion="polite" style={styles.hint}>
        {selected?.hint ??
          "Đang áp dụng bộ lọc trước đó. Chọn một nhóm để thay đổi."}
      </Text>
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
