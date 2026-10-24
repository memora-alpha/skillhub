import { useRef } from "react";
import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { appColors, appRadius } from "@/constants/theme";
import type { RequestDraft } from "../schemas/request-form";
import { slotRows, slotRowsValue } from "../utils/request-dates";
import { weeklyRows } from "../utils/request-weekly-slots";
import { createWeeklyEditor } from "../utils/request-weekly-editor";
import { RequestSavedSlots } from "./request-saved-slots";
import { RequestWeeklyRow } from "./request-weekly-row";
import { RequestSection } from "./request-section";
import { RequestDeadlineFields } from "./request-deadline-fields";
import { requestTimeZoneNote } from "../utils/request-time-zone";

export function RequestTimeFields({
  form,
  disabled,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}>) {
  const editor = useRef(createWeeklyEditor()).current;
  const weekly = weeklyRows(form.watch("weeklyAvailability")) ?? [];
  const saved = slotRows(form.watch("preferredSlots"));
  let summary = "Thêm lịch rảnh hằng tuần";
  if (saved.length) summary = `${saved.length} khoảng ngày đã lưu`;
  if (weekly.length) summary = `${weekly.length} khoảng mỗi tuần`;
  return (
    <>
      <RequestSection
        title="Thời gian ưu tiên"
        icon="clock"
        compact
        collapsible
        summary={summary}
        hasError={
          !!(
            form.formState.errors.weeklyAvailability ||
            form.formState.errors.preferredSlots ||
            form.formState.errors.timeZone
          )
        }
        disabled={disabled}
      >
        <Controller
          control={form.control}
          name="weeklyAvailability"
          render={({ field, fieldState }) => {
            const entries = editor.sync(field.value);
            const change = (next: string | undefined) => {
              if (disabled || next === undefined) return;
              field.onChange(next);
              field.onBlur();
            };
            return (
              <View style={{ gap: 12 }}>
                <Controller
                  control={form.control}
                  name="timeZone"
                  render={({ field: zone, fieldState: zoneState }) => (
                    <View style={{ gap: 6 }}>
                      <Copy muted>{requestTimeZoneNote(zone.value)}</Copy>
                      {zoneState.error && (
                        <FormNotice tone="error">
                          {zoneState.error.message}
                        </FormNotice>
                      )}
                    </View>
                  )}
                />
                {entries.map(({ key, row }, index) => (
                  <RequestWeeklyRow
                    key={key}
                    row={row}
                    index={index}
                    disabled={disabled}
                    hasError={!!fieldState.error}
                    onRemove={() => {
                      if (!disabled) change(editor.remove(key));
                    }}
                    onChange={(updated) => {
                      if (!disabled) change(editor.update(key, updated));
                    }}
                  />
                ))}
                {fieldState.error &&
                  (form.formState.isSubmitted ||
                    entries.every(
                      ({ row }) => row.weekday && row.startTime && row.endTime,
                    )) && (
                    <FormNotice tone="error">
                      {fieldState.error.message}
                    </FormNotice>
                  )}
                {entries.length > 0 && !!form.watch("preferredSlots") && (
                  <Copy muted>
                    Lưu lịch tuần sẽ thay thế các khoảng ngày đã lưu.
                  </Copy>
                )}
                <Button
                  variant="paper"
                  style={{
                    minHeight: 48,
                    borderRadius: appRadius.card,
                    borderStyle: "dashed",
                    backgroundColor: appColors.surfaceLow,
                  }}
                  disabled={disabled || entries.length >= 5}
                  onPress={() => {
                    if (!disabled) change(editor.append());
                  }}
                >
                  {entries.length >= 5
                    ? "Đã chọn tối đa 5 khoảng"
                    : "Thêm giờ rảnh"}
                </Button>
              </View>
            );
          }}
        />
        <Controller
          control={form.control}
          name="preferredSlots"
          render={({ field, fieldState }) => (
            <RequestSavedSlots
              rows={slotRows(field.value)}
              disabled={disabled}
              error={fieldState.error?.message}
              onRemove={(index) => {
                field.onChange(
                  slotRowsValue(
                    slotRows(form.getValues("preferredSlots")).filter(
                      (_row, i) => i !== index,
                    ),
                  ),
                );
                field.onBlur();
              }}
            />
          )}
        />
      </RequestSection>
      <RequestDeadlineFields form={form} disabled={disabled} />
    </>
  );
}
