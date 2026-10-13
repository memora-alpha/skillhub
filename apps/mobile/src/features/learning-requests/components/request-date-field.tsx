import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/choice-group";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import {
  appColors as colors,
  appRadius as radius,
  fonts,
} from "@/constants/theme";
import { parseLocalDateTime } from "@/utils/local-date-time";
import {
  pickerValue,
  selectDatePart,
  type DatePart,
} from "../utils/request-dates";
import { RequestDatePicker } from "./request-date-picker";

export function RequestDateField({
  label,
  value,
  onChange,
  disabled,
  seed,
  mode = "datetime",
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  seed?: string;
  mode?: "date" | "time" | "datetime";
}>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const [part, setPart] = useState<DatePart>("date");
  const selected = parseLocalDateTime(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valid =
    mode === "time" ||
    (mode === "date"
      ? draft.getTime() >= today.getTime()
      : (parseLocalDateTime(pickerValue(draft))?.getTime() ?? 0) > Date.now());
  const emptyLabel = {
    date: "Chọn ngày",
    time: "Chọn giờ",
    datetime: "Chọn ngày và giờ",
  }[mode];
  const timeLabel = (date: Date) =>
    date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  let valueLabel = emptyLabel;
  let hintLabel = "Chạm để chọn";
  if (selected) {
    valueLabel =
      mode === "time"
        ? timeLabel(selected)
        : selected.toLocaleDateString("vi-VN");
    hintLabel = "Giờ thiết bị";
    if (mode === "datetime")
      hintLabel = `${timeLabel(selected)} · Giờ thiết bị`;
  }
  let draftLabel = draft.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (mode === "time") draftLabel = timeLabel(draft);
  else if (mode === "date") draftLabel = draft.toLocaleDateString("vi-VN");
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  function begin() {
    if (disabled) return;
    const suggested = selected ?? parseLocalDateTime(seed ?? "");
    setDraft(
      suggested && (mode !== "datetime" || suggested.getTime() > Date.now())
        ? suggested
        : new Date(Date.now() + 60 * 60 * 1000),
    );
    setPart(mode === "time" ? "time" : "date");
    setOpen(true);
  }
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueLabel}`}
        accessibilityState={{ disabled, expanded: open && !disabled }}
        disabled={disabled}
        onPress={begin}
        style={[
          styles.field,
          mode === "time" && styles.timeField,
          disabled && { opacity: 0.55 },
          open && styles.active,
        ]}
      >
        <Icon
          name={mode === "time" ? "clock" : "calendar"}
          color={colors.primary}
          size={16}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.value}>{valueLabel}</Text>
          {(!selected || mode === "datetime") && (
            <Text style={styles.hint}>{hintLabel}</Text>
          )}
        </View>
        <Icon name="chevron" color={colors.muted} size={16} />
      </Pressable>
      {open && !disabled && (
        <View style={styles.picker}>
          {mode === "datetime" && (
            <ChoiceGroup
              label={`Chọn ${label.toLowerCase()}`}
              options={["Ngày", "Giờ"]}
              value={part === "date" ? "Ngày" : "Giờ"}
              onChange={(next) => setPart(next === "Ngày" ? "date" : "time")}
            />
          )}
          <RequestDatePicker
            value={draft}
            mode={mode === "datetime" ? part : mode}
            onChange={(next) =>
              setDraft(
                selectDatePart(draft, next, mode === "datetime" ? part : mode),
              )
            }
          />
          <Text style={styles.hint}>
            {draftLabel} {mode !== "time" && "· Giờ thiết bị"}
          </Text>
          {!valid && (
            <FormNotice tone="error">
              {mode === "date"
                ? "Chọn ngày từ hôm nay trở đi."
                : "Chọn thời điểm trong tương lai."}
            </FormNotice>
          )}
          <View style={styles.actions}>
            <Button
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => setOpen(false)}
              accessibilityLabel={`Bỏ chọn ${label.toLowerCase()}`}
            >
              Hủy
            </Button>
            <Button
              variant="paper"
              style={{ flex: 1 }}
              disabled={!valid}
              accessibilityLabel={`Xác nhận ${label.toLowerCase()}`}
              onPress={() => {
                if (!disabled && valid) {
                  onChange(pickerValue(draft));
                  setOpen(false);
                }
              }}
            >
              Xong
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  value: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  field: {
    minHeight: 64,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  active: { borderColor: colors.primary },
  timeField: { minHeight: 52, padding: 10 },
  picker: {
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceLow,
  },
  actions: { flexDirection: "row", gap: 8 },
});
