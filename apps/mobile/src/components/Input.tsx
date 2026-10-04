import { useState, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, fonts } from "@/constants/theme";
import { Icon } from "./Icon";

type InputProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  password?: boolean;
  ref?: Ref<TextInput>;
};

export function Input({
  label,
  required,
  error,
  password,
  ref,
  ...props
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View
        style={[
          styles.field,
          !!error && styles.invalid,
          focused && styles.focused,
        ]}
      >
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error}
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
          style={[styles.input, password && { paddingRight: 40 }, props.style]}
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
      {!!error && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={12} color={colors.error} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 4 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  required: { color: colors.brand },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  focused: { borderColor: colors.brand, boxShadow: "0 0 0 2px #D4622A" },
  invalid: { borderColor: colors.error, backgroundColor: colors.errorLight },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    includeFontPadding: false,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  eye: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  error: {
    flex: 1,
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
