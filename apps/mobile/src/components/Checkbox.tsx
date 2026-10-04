import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";
import { Icon } from "./Icon";

export function Checkbox({
  checked,
  onChange,
  children,
  label,
  error,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
  label: string;
  error?: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked }}
          aria-checked={checked}
          hitSlop={8}
          onPress={() => onChange(!checked)}
          style={[styles.box, checked && styles.checked]}
        >
          {checked && <Icon name="check" size={10} color={colors.white} />}
        </Pressable>
        <Text style={styles.label} onPress={() => onChange(!checked)}>
          {children}
        </Text>
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  box: {
    width: 16,
    height: 16,
    marginTop: 2,
    borderWidth: 2,
    borderColor: colors.borderDark,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22.75,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  error: {
    marginLeft: 26,
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
