import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { typography, colors, fonts, radius } from "@/constants/theme";
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
          hitSlop={10}
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
    width: 20,
    height: 20,
    marginTop: 1,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: {
    flexShrink: 1,
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  error: {
    marginLeft: 30,
    color: colors.error,
    fontFamily: fonts.body,
    ...typography.secondary,
    includeFontPadding: false,
  },
});
