import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import type { RequestDraft } from "../schemas/request-form";
import {
  requestFormColors as colors,
  requestFormStyles as styles,
} from "./request-form.styles";

export function RequestTextField({
  form,
  name,
  label,
  required,
  hint,
  disabled,
  multiline,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText" | "editable"> & {
  form: UseFormReturn<RequestDraft>;
  name:
    | "title"
    | "description"
    | "learningGoal"
    | "teachingOverview"
    | "desiredCreditPerHour";
  label: string;
  required?: boolean;
  hint?: string;
  disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(80);
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={{ color: colors.accent }}> *</Text>}
          </Text>
          <TextInput
            {...props}
            ref={field.ref}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={() => {
              field.onBlur();
              setFocused(false);
            }}
            onFocus={() => setFocused(true)}
            onContentSizeChange={(event) => {
              if (multiline)
                setContentHeight(
                  Math.max(80, event.nativeEvent.contentSize.height),
                );
              props.onContentSizeChange?.(event);
            }}
            editable={!disabled}
            multiline={multiline}
            accessibilityLabel={label}
            accessibilityHint={fieldState.error?.message ?? hint}
            aria-invalid={!!fieldState.error}
            placeholderTextColor={colors.mutedLight}
            style={[
              styles.input,
              multiline && { minHeight: 80, height: contentHeight },
              focused && {
                borderColor: colors.accent,
                backgroundColor: colors.surface,
              },
              !!fieldState.error && { borderColor: colors.error },
              disabled && { opacity: 0.6 },
            ]}
          />
          {!!fieldState.error && (
            <Text
              selectable
              accessibilityLiveRegion="polite"
              style={[styles.hint, { color: colors.error }]}
            >
              {fieldState.error.message}
            </Text>
          )}
          {!fieldState.error && !!hint && focused && (
            <Text
              style={[styles.hint, { textAlign: multiline ? "right" : "left" }]}
            >
              {hint}
            </Text>
          )}
        </View>
      )}
    />
  );
}
