import { Children, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function SettingsIntro({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  radioGroup = false,
}: Readonly<{
  title?: string;
  description?: string;
  children: ReactNode;
  radioGroup?: boolean;
}>) {
  return (
    <View style={styles.section}>
      {title && (
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      )}
      {description && <Text style={styles.description}>{description}</Text>}
      <View
        style={styles.card}
        role={radioGroup ? "radiogroup" : undefined}
        accessibilityLabel={radioGroup ? title : undefined}
      >
        {Children.toArray(children).map((child, index) => (
          <View key={index} style={index > 0 && styles.separator}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SettingsNote({
  icon = "shield",
  children,
}: Readonly<{ icon?: IconName; children: ReactNode }>) {
  return (
    <View style={styles.note}>
      <Icon name={icon} size={16} color={colors.forest} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function SettingsSaveButton({
  pending,
  disabled,
  onPress,
}: Readonly<{ pending: boolean; disabled: boolean; onPress: () => void }>) {
  return (
    <Button
      size="lg"
      variant="craft"
      leadingIcon={pending ? undefined : "check"}
      disabled={disabled}
      accessibilityState={{ busy: pending }}
      onPress={onPress}
    >
      {pending ? "Đang lưu..." : "Lưu thay đổi"}
    </Button>
  );
}

export function SettingsChoice({
  label,
  description,
  selected,
  disabled,
  onPress,
}: Readonly<{
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}>) {
  const onKeyDown: NonNullable<PressableProps["onKeyDown"]> = (event) => {
    if (disabled || Platform.OS !== "web") return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const key = event.nativeEvent.key;
    if (key === " " || key === "Spacebar") {
      event.preventDefault();
      onPress();
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)
    ) {
      event.preventDefault();
      const group = target.closest('[role="radiogroup"]');
      const options = Array.from(
        group?.querySelectorAll<HTMLElement>(
          '[role="radio"]:not([aria-disabled="true"])',
        ) ?? [],
      );
      const direction = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      const next =
        options[
          (options.indexOf(target) + direction + options.length) %
            options.length
        ];
      next?.focus();
      next?.click();
    }
  };
  return (
    <Pressable
      onKeyDown={Platform.OS === "web" ? onKeyDown : undefined}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.selectedChoice,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, selected && styles.selectedText]}>
          {label}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.selectedRadio]}>
        {selected && <Icon name="check" size={14} color={colors.white} />}
      </View>
    </Pressable>
  );
}

export function SettingsFact({
  icon,
  label,
  children,
}: Readonly<{ icon: IconName; label: string; children: ReactNode }>) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={colors.forest} />
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{label}</Text>
        {typeof children === "string" ? (
          <Text selectable style={styles.description}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  nativeControl: { alignSelf: "stretch", width: "100%" },
  padded: { padding: 18, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.body },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
  },
  inlineAction: { alignSelf: "flex-start", paddingHorizontal: 0 },
});

const styles = StyleSheet.create({
  intro: { gap: 8, paddingTop: 4 },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  description: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  section: { gap: 10 },
  sectionTitle: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
    paddingHorizontal: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
  },
  noteText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    flex: 1,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    minHeight: 82,
  },
  selectedChoice: { backgroundColor: colors.primarySoft },
  choiceCopy: { flex: 1, minWidth: 0, gap: 4 },
  choiceTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  selectedText: { color: colors.primaryDark },
  radio: {
    width: 24,
    height: 24,
    borderRadius: appRadius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedRadio: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  fact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 18,
  },
});
