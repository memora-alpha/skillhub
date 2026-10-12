import { View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { dateLabel } from "../utils/request-policy";
import type { SlotRow } from "../utils/request-dates";
import { parseLocalDateTime } from "@/utils/local-date-time";

export function RequestSavedSlots({
  rows,
  disabled,
  error,
  onRemove,
}: {
  rows: SlotRow[];
  disabled: boolean;
  error?: string;
  onRemove: (index: number) => void;
}) {
  if (!rows.length) return null;
  const label = (value: string) => {
    const date = parseLocalDateTime(value);
    return date ? dateLabel(date.toISOString()) : value;
  };
  return (
    <View style={{ gap: 8 }}>
      <Copy>Khoảng ngày đã lưu</Copy>
      {rows.map((row, index) => (
        <View key={`${index}:${row.startAt}`} style={{ gap: 4 }}>
          <Copy muted>
            {label(row.startAt)} → {label(row.endAt)}
          </Copy>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            accessibilityLabel={`Xóa khoảng ngày đã lưu ${index + 1}`}
            onPress={() => onRemove(index)}
          >
            Xóa
          </Button>
        </View>
      ))}
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </View>
  );
}
