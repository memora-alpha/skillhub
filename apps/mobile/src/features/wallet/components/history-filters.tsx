import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { HistoryFilterControl } from "./history-filter-control";
import {
  transactionTypes,
  referenceTypes,
  type HistoryFilters as Selection,
} from "../types/transaction";
import { transactionLabel } from "../utils/transaction-labels";

export function HistoryFilters({
  filters,
  onChange,
}: {
  filters: Selection;
  onChange: (value: Selection) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Copy>Loại giao dịch</Copy>
      <HistoryFilterControl
        label="Loại giao dịch"
        value={filters.type ?? ""}
        options={[
          { value: "", label: "Tất cả loại giao dịch" },
          ...transactionTypes.map((value) => ({
            value,
            label: transactionLabel(value),
          })),
        ]}
        onChange={(value) =>
          onChange({
            ...filters,
            type: (value || undefined) as Selection["type"],
          })
        }
      />
      <Copy>Loại tham chiếu</Copy>
      <HistoryFilterControl
        label="Loại tham chiếu"
        value={filters.referenceType ?? ""}
        options={[
          { value: "", label: "Tất cả tham chiếu" },
          ...referenceTypes.map((value) => ({ value, label: value })),
        ]}
        onChange={(value) =>
          onChange({
            ...filters,
            referenceType: (value || undefined) as Selection["referenceType"],
          })
        }
      />
      {(filters.type || filters.referenceType) && (
        <Button variant="paper" onPress={() => onChange({})}>
          Xóa bộ lọc
        </Button>
      )}
    </View>
  );
}
