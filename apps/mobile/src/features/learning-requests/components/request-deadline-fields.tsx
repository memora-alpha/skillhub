import { View } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { RequestSection } from "./request-section";
import { RequestDateField } from "./request-date-field";
import type { RequestDraft } from "../schemas/request-form";

export function RequestDeadlineFields({
  form,
  disabled,
}: Readonly<{
  form: UseFormReturn<RequestDraft>;
  disabled: boolean;
}>) {
  return (
    <RequestSection
      title="Hạn đăng bài"
      icon="calendar"
      subtitle="Không bắt buộc"
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
    </RequestSection>
  );
}
