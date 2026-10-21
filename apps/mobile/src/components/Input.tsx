import { useState, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { typography, colors, fonts, radius } from "@/constants/theme";
import { Icon } from "./Icon";

type InputProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  password?: boolean;
  reserveMessageSpace?: boolean;
  hideLabel?: boolean;
  ref?: Ref<TextInput>;
};

export function Input({
  label,
  required,
  error,
  hint,
  password,
  reserveMessageSpace,
  hideLabel = false,
  ref,
  ...props
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      {!hideLabel && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.field,
          props.editable === false && styles.readOnly,
          focused && props.editable !== false && !error && styles.focused,
          !!error && styles.invalid,
        ]}
      >
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          aria-invalid={!!error}
          placeholderTextColor={colors.mutedLight}
          secureTextEntry={password && !visible}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            props.multiline && styles.textarea,
            password && { paddingRight: 48 },
            props.style,
          ]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible
                ? `Ẩn ${label.toLowerCase()}`
                : `Hiện ${label.toLowerCase()}`
            }
            onPress={() => setVisible(!visible)}
            style={styles.eye}
            hitSlop={6}
          >
            <Icon
              name={visible ? "eye-off" : "eye"}
              size={16}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
      {(reserveMessageSpace || !!error || !!hint) && (
        <View style={reserveMessageSpace && styles.messageSpace}>
          {!!error && (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <Icon name="alert" size={12} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
          {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 6 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  required: { color: colors.brand },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  focused: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  readOnly: { backgroundColor: colors.sand },
  invalid: { borderColor: colors.error },
  input: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    includeFontPadding: false,
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
  },
  textarea: { minHeight: 104, paddingTop: 12 },
  eye: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  messageSpace: { minHeight: typography.secondary.lineHeight },
  error: {
    flex: 1,
    color: colors.error,
    fontFamily: fonts.body,
    ...typography.secondary,
    includeFontPadding: false,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.body,
    ...typography.secondary,
    includeFontPadding: false,
  },
});
