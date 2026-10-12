import { View } from "react-native";
import { ChoiceGroup } from "@/components/choice-group";
import {
  weekdays,
  weekdayLabels,
  type WeeklyRow,
} from "../utils/request-weekly-slots";
import { RequestDateField } from "./request-date-field";

export function RequestSlotFields({
  row,
  index,
  disabled,
  onChange,
}: {
  row: WeeklyRow;
  index: number;
  disabled: boolean;
  onChange: (row: WeeklyRow) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <ChoiceGroup
        label={`Thứ trong tuần · Khoảng ${index + 1}`}
        options={weekdayLabels}
        value={
          row.weekday
            ? (weekdayLabels[weekdays.indexOf(row.weekday)] ?? "")
            : ""
        }
        disabled={disabled}
        onChange={(label) =>
          onChange({
            ...row,
            weekday:
              weekdays[
                weekdayLabels.indexOf(label as (typeof weekdayLabels)[number])
              ]!,
          })
        }
      />
      <View style={{ gap: 10 }}>
        {(["startTime", "endTime"] as const).map((point) => (
          <View key={point}>
            <RequestDateField
              label={`${point === "startTime" ? "Từ" : "Đến"} · Khoảng ${index + 1}`}
              mode="time"
              value={row[point] ? `2000-01-01T${row[point]}` : ""}
              disabled={disabled || !row.weekday}
              seed="2000-01-01T00:00"
              onChange={(value) =>
                onChange({ ...row, [point]: value.split("T")[1]! })
              }
            />
          </View>
        ))}
      </View>
    </View>
  );
}
