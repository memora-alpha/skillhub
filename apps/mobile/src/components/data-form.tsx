import { useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ControlledInput } from "./ControlledInput";
import { Button } from "./Button";
import { FormNotice } from "./FormNotice";
import { ChoiceGroup } from "./choice-group";
import { errorMessage } from "@/lib/http/errors";

export type DataField = {
  name: string;
  label: string;
  rule: z.ZodType<string, string>;
  multiline?: boolean;
  hint?: string;
  numeric?: boolean;
  choices?: readonly string[];
};
export function DataForm({
  fields,
  defaults = {},
  submitLabel = "Lưu bản xem thử",
  onSubmit,
  disabled = false,
}: {
  fields: readonly DataField[];
  defaults?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (
    values: Record<string, string>,
  ) => void | string | Promise<void | string>;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const schema = z.object(
    Object.fromEntries(fields.map((f) => [f.name, f.rule])),
  );
  const { control, handleSubmit, watch, setValue, formState } = useForm<
    Record<string, string>
  >({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, defaults[f.name] ?? ""]),
    ),
  });
  return (
    <View style={{ gap: 14 }}>
      {fields.map((f) => (
        <View key={f.name} style={{ gap: 6 }}>
          {f.choices ? (
            <ChoiceGroup
              label={f.label}
              options={f.choices}
              value={watch(f.name)}
              disabled={disabled || pending}
              onChange={(v) => setValue(f.name, v, { shouldValidate: true })}
            />
          ) : (
            <ControlledInput
              control={control}
              name={f.name}
              label={f.label}
              multiline={f.multiline}
              editable={!disabled && !pending}
              hint={f.hint}
              keyboardType={f.numeric ? "decimal-pad" : "default"}
            />
          )}
          {f.choices && formState.errors[f.name] && (
            <FormNotice tone="error">
              {formState.errors[f.name]?.message}
            </FormNotice>
          )}
        </View>
      ))}
      {error && <FormNotice tone="error">{error}</FormNotice>}
      <Button
        variant="craft"
        disabled={disabled || pending}
        onPress={() =>
          void handleSubmit(async (values) => {
            if (disabled || pending) return;
            setPending(true);
            setError(undefined);
            try {
              setError((await onSubmit(values)) || undefined);
            } catch (cause) {
              setError(errorMessage(cause));
            } finally {
              setPending(false);
            }
          })()
        }
      >
        {pending ? "Đang xử lý…" : submitLabel}
      </Button>
    </View>
  );
}
export const textRule = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Nhập ít nhất ${min} ký tự.`)
    .max(max, `Tối đa ${max} ký tự.`);
export const integerRule = (min: number, max?: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        /^\d+$/.test(v) &&
        Number.isSafeInteger(Number(v)) &&
        Number(v) >= min &&
        (max === undefined || Number(v) <= max),
      `Nhập số nguyên từ ${min}${max ? ` đến ${max}` : ""}.`,
    );
export const creditRule = (min = 0, inclusive = false) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        /^\d{1,10}(\.\d{1,2})?$/.test(v) &&
        (inclusive ? Number(v) >= min : Number(v) > min),
      `Credit ${inclusive ? "từ" : "lớn hơn"} ${min}, tối đa 2 số thập phân.`,
    );
