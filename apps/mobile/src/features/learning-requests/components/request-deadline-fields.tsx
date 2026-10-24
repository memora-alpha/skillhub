import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { RequestSection } from "./request-section";
import { RequestDateField } from "./request-date-field";
import type { RequestDraft } from "../schemas/request-form";
import { parseLocalDateTime } from "@/utils/local-date-time";

export function RequestDeadlineFields({
  form,
  disabled,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}>) {
  const date = parseLocalDateTime(form.watch("expiresAt"));
  const summary = date
    ? date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "Dùng thời hạn mặc định";
  return (
    <RequestSection
      title="Hạn đăng bài"
      icon="calendar"
      compact
      collapsible
      summary={summary}
      hasError={!!form.formState.errors.expiresAt}
      disabled={disabled}
    >
      <Controller
        control={form.control}
        name="expiresAt"
        render={({ field, fieldState }) => (
          <View style={{ gap: 8 }}>
            <RequestDateField
              key={field.value}
              label="Thời hạn hiển thị bài"
              value={field.value}
              disabled={disabled}
              onChange={(value) => {
                field.onChange(value);
                field.onBlur();
              }}
            />
            {!field.value && (
              <Copy muted>Dùng thời hạn mặc định nếu không chọn.</Copy>
            )}
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
    </RequestSection>
  );
}
