import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors, appRadius } from "@/constants/theme";
import {
  validWeeklyRows,
  weeklyRowsValue,
  weekdays,
  weekdayLabels,
  type WeeklyRow,
} from "../utils/request-weekly-slots";
import { RequestSlotFields } from "./request-slot-fields";
import { requestFormStyles as styles } from "./request-form.styles";

export function RequestWeeklyRow({
  row,
  index,
  disabled,
  hasError,
  onChange,
  onRemove,
}: Readonly<{
  row: WeeklyRow;
  index: number;
  disabled: boolean;
  hasError: boolean;
  onChange: (row: WeeklyRow) => void;
  onRemove: () => void;
}>) {
  const complete = validWeeklyRows(weeklyRowsValue([row]));
  const [editing, setEditing] = useState(!complete);
  const expanded = editing || !complete || hasError;
  const day = row.weekday && weekdayLabels[weekdays.indexOf(row.weekday)];
  const label = complete
    ? `${day} · ${row.startTime}–${row.endTime}`
    : `Khoảng ${index + 1}`;
  return (
    <View
      style={{
        padding: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: appColors.border,
        borderRadius: appRadius.card,
        backgroundColor: appColors.canvas,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sửa ${label}`}
          accessibilityState={{ expanded, disabled }}
          disabled={disabled}
          onPress={() => setEditing(!expanded)}
          style={{
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
          <Icon name="chevron" size={16} color={appColors.muted} />
        </Pressable>
        <Button
          variant="ghost"
          size="sm"
          style={{ minHeight: 44 }}
          disabled={disabled}
          accessibilityLabel={`Xóa khoảng ${index + 1}`}
          onPress={onRemove}
        >
          Xóa
        </Button>
      </View>
      {expanded && (
        <>
          <RequestSlotFields
            row={row}
            index={index}
            disabled={disabled}
            onChange={onChange}
          />
          {complete && !hasError && (
            <Button
              variant="ghost"
              size="sm"
              style={{ minHeight: 44 }}
              disabled={disabled}
              onPress={() => setEditing(false)}
            >
              Xong
            </Button>
          )}
        </>
      )}
    </View>
  );
}
