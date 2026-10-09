import type { ComponentProps } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Input } from "./Input";

type ControlledInputProps<TValues extends FieldValues> = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChangeText" | "onBlur" | "error"
> & {
  control: Control<TValues>;
  name: Path<TValues>;
  onChangeText?: (value: string) => void;
  normalizeText?: (value: string) => string;
};

export function ControlledInput<TValues extends FieldValues>({
  control,
  name,
  onChangeText,
  normalizeText,
  ...props
}: ControlledInputProps<TValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          reserveMessageSpace
          {...props}
          ref={field.ref}
          value={String(field.value ?? "")}
          onBlur={field.onBlur}
          onChangeText={(value) => {
            const next = normalizeText ? normalizeText(value) : value;
            field.onChange(next);
            onChangeText?.(next);
          }}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
