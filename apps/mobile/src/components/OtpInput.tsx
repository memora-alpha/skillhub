import { useState, type Ref } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextInputInstance,
} from "react-native";
import { colors, fonts, radius, typography } from "@/constants/theme";
import { Icon } from "./Icon";

type OtpInputProps = Pick<
  TextInputProps,
  "editable" | "onBlur" | "onSubmitEditing"
> & {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  ref?: Ref<TextInputInstance>;
};

export function OtpInput({
  value,
  onChangeText,
  error,
  editable = true,
  onBlur,
  onSubmitEditing,
  ref,
}: OtpInputProps) {
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        Mã xác minh <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.field}>
        {/* One native input keeps paste, deletion and OS autofill intact. */}
        <TextInput
          ref={ref}
          value={value}
          editable={editable}
          accessibilityLabel="Mã xác minh"
          accessibilityHint={error ?? "Mã gồm 6 chữ số."}
          aria-invalid={!!error}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoCapitalize="none"
          autoCorrect={false}
          caretHidden
          underlineColorAndroid="transparent"
          returnKeyType="go"
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onSelectionChange={(event) =>
            setSelection(event.nativeEvent.selection)
          }
          onChangeText={(text) =>
            onChangeText(text.replace(/\D/g, "").slice(0, 6))
          }
          style={styles.input}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={styles.cells}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.cell,
                !!value[index] && styles.filled,
                !editable && styles.disabled,
                !!error && styles.invalid,
                focused &&
                  editable &&
                  !error &&
                  index >= Math.min(selection.start, 5) &&
                  index <= Math.min(selection.end, 5) &&
                  styles.active,
              ]}
            >
              <Text style={styles.digit}>{value[index] ?? ""}</Text>
              {!value[index] && <View style={styles.placeholder} />}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.messageSpace}>
        {!!error && (
          <View style={styles.errorRow} accessibilityLiveRegion="polite">
            <Icon name="alert" size={12} color={colors.error} />
            <Text selectable style={styles.error}>
              {error}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  required: { color: colors.brand },
  field: { minHeight: 56 },
  input: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: typography.title.fontSize,
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
  },
  cells: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  filled: { borderColor: colors.borderDark },
  active: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  disabled: { backgroundColor: colors.sand },
  invalid: { borderColor: colors.error },
  digit: {
    ...typography.title,
    fontFamily: fonts.bold,
    fontVariant: ["tabular-nums"],
    color: colors.ink,
    includeFontPadding: false,
  },
  placeholder: {
    position: "absolute",
    width: 12,
    height: 2,
    backgroundColor: colors.borderDark,
  },
  messageSpace: { minHeight: typography.secondary.lineHeight },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  error: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
    includeFontPadding: false,
  },
});
