import { useState, type ReactNode, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type TextInputInstance,
  type ViewStyle,
} from "react-native";
import { typography, colors, fonts, radius } from "@/constants/theme";
import { Icon } from "./Icon";

type InputProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelStyle?: StyleProp<TextStyle>;
  password?: boolean;
  reserveMessageSpace?: boolean;
  fieldStyle?: StyleProp<ViewStyle>;
  rightAccessory?: ReactNode;
  hideLabel?: boolean;
  ref?: Ref<TextInputInstance>;
};

export function Input({
  label,
  required,
  error,
  hint,
  labelStyle,
  password,
  reserveMessageSpace,
  fieldStyle,
  rightAccessory,
  hideLabel = false,
  ref,
  ...props
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      {!hideLabel && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.field,
          fieldStyle,
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
            (!!password || !!rightAccessory) && { paddingRight: 52 },
            props.style,
          ]}
        />
        {!!rightAccessory && (
          <View pointerEvents="none" style={styles.trailingAccessory}>
            {rightAccessory}
          </View>
        )}
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
  trailingAccessory: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
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
