import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import {
  appColors as colors,
  fonts,
  typography,
  radius,
} from "@/constants/theme";

export function ActionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <View style={styles.group}>
        {Children.toArray(children).map((child, index) => (
          <View key={index} style={index > 0 && styles.separator}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function ActionRow({
  icon,
  label,
  description,
  onPress,
  disabled = false,
  destructive = false,
  iconTint,
}: Readonly<{
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  iconTint?: Readonly<{ foreground: string; background: string }>;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.icon,
          iconTint && {
            backgroundColor: iconTint.background,
            borderRadius: radius.card,
          },
        ]}
      >
        <Icon
          name={icon}
          color={
            destructive
              ? colors.error
              : (iconTint?.foreground ?? colors.inkSoft)
          }
          size={20}
          filled={false}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, destructive && { color: colors.error }]}>
          {label}
        </Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Icon name="chevron" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.inkSoft,
    paddingHorizontal: 4,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    padding: 14,
  },
  pressed: { backgroundColor: colors.canvas },
  disabled: { opacity: 0.5 },
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    includeFontPadding: false,
  },
  description: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
});
