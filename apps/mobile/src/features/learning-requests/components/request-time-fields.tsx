import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { appColors, appRadius } from "@/constants/theme";
import type { RequestDraft } from "../schemas/request-form";
import { slotRows, slotRowsValue } from "../utils/request-dates";
import { weeklyRows, weeklyRowsValue } from "../utils/request-weekly-slots";
import { RequestSavedSlots } from "./request-saved-slots";
import { RequestDateField } from "./request-date-field";
import { RequestSlotFields } from "./request-slot-fields";

export function RequestTimeFields({
  form,
  disabled,
}: {
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}) {
  return (
    <View style={{ gap: 20 }}>
      <Controller
        control={form.control}
        name="weeklyAvailability"
        render={({ field, fieldState }) => {
          const rows = weeklyRows(field.value) ?? [];
          const currentRows = () =>
            weeklyRows(form.getValues("weeklyAvailability")) ?? [];
          const change = (next: typeof rows) => {
            field.onChange(weeklyRowsValue(next));
            field.onBlur();
          };
          return (
            <View style={{ gap: 12 }}>
              <Copy>Thời gian ưu tiên (không bắt buộc)</Copy>
              <Copy muted>Lặp hằng tuần · Giờ thiết bị · Tối đa 5 khoảng.</Copy>
              {rows.map((row, index) => (
                <View
                  key={`${index}:${row.weekday}:${row.startTime}:${row.endTime}`}
                  style={{
                    padding: 12,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: appColors.border,
                    borderRadius: appRadius.card,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Copy>Khoảng {index + 1}</Copy>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      accessibilityLabel={`Xóa khoảng ${index + 1}`}
                      onPress={() =>
                        change(currentRows().filter((_item, i) => i !== index))
                      }
                    >
                      Xóa
                    </Button>
                  </View>
                  <RequestSlotFields
                    row={row}
                    index={index}
                    disabled={disabled}
                    onChange={(updated) =>
                      change(
                        currentRows().map((item, i) =>
                          i === index ? updated : item,
                        ),
                      )
                    }
                  />
                </View>
              ))}
              {fieldState.error &&
                rows.every(
                  (row) => row.weekday && row.startTime && row.endTime,
                ) && (
                  <FormNotice tone="error">
                    {fieldState.error.message}
                  </FormNotice>
                )}
              {rows.length > 0 && (
                <FormNotice tone="info">
                  Lịch theo tuần chưa hỗ trợ lưu.
                </FormNotice>
              )}
              <Button
                variant="paper"
                disabled={disabled || rows.length >= 5}
                onPress={() => {
                  const current = currentRows();
                  if (!disabled && current.length < 5)
                    change([
                      ...current,
                      { weekday: "", startTime: "", endTime: "" },
                    ]);
                }}
              >
                {rows.length >= 5 ? "Đã chọn tối đa 5 khoảng" : "Thêm giờ rảnh"}
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
      <Controller
        control={form.control}
        name="expiresAt"
        render={({ field, fieldState }) => (
          <View style={{ gap: 8 }}>
            <RequestDateField
              key={field.value}
              label="Hạn đăng bài (không bắt buộc)"
              value={field.value}
              disabled={disabled}
              onChange={(value) => {
                field.onChange(value);
                field.onBlur();
              }}
            />
            {!field.value && <Copy muted>Để trống để dùng hạn mặc định.</Copy>}
            {!!field.value && (
              <Button
                variant="ghost"
                disabled={disabled}
                onPress={() => {
                  field.onChange("");
                  field.onBlur();
                }}
              >
                Dùng hạn mặc định
              </Button>
            )}
            {fieldState.error && (
              <FormNotice tone="error">{fieldState.error.message}</FormNotice>
            )}
          </View>
        )}
      />
    </View>
  );
}
