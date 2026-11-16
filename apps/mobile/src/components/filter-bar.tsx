import { useEffect, useRef, type ReactNode, type ComponentRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";

export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  label,
  action,
  disabled = false,
  role = "button",
}: Readonly<{
  options: readonly { value: T; label: string; accessibilityLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  action?: ReactNode;
  disabled?: boolean;
  role?: "button" | "radio" | "tab";
}>) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef(new Map<T, number>());
  useEffect(() => {
    const x = offsets.current.get(value);
    if (x !== undefined)
      scroll.current?.scrollTo({ x: Math.max(0, x - 4), animated: false });
  }, [value]);
  return (
    <View style={styles.toolbar}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.options}
        accessibilityLabel={label}
      >
        <View
          style={styles.options}
          accessibilityRole={
            role === "radio"
              ? "radiogroup"
              : role === "tab"
                ? "tablist"
                : undefined
          }
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <View
                key={option.value}
                onLayout={(event) => {
                  offsets.current.set(option.value, event.nativeEvent.layout.x);
                  if (selected)
                    scroll.current?.scrollTo({
                      x: Math.max(0, event.nativeEvent.layout.x - 4),
                      animated: false,
                    });
                }}
              >
                <Pressable
                  accessibilityRole={role}
                  accessibilityLabel={option.accessibilityLabel ?? option.label}
                  accessibilityState={
                    role === "radio"
                      ? { checked: selected, disabled }
                      : { selected, disabled }
                  }
                  aria-selected={role !== "radio" ? selected : undefined}
                  aria-pressed={role === "button" ? selected : undefined}
                  aria-checked={role === "radio" ? selected : undefined}
                  disabled={disabled}
                  onPress={() => onChange(option.value)}
                  onKeyDown={
                    Platform.OS === "web" && role !== "button"
                      ? (event) => {
                          if (disabled) return;
                          const key = event.nativeEvent.key;
                          if (
                            key === " " ||
                            key === "Spacebar" ||
                            key === "Enter"
                          ) {
                            event.preventDefault();
                            onChange(option.value);
                          } else if (
                            key === "ArrowLeft" ||
                            key === "ArrowRight"
                          ) {
                            event.preventDefault();
                            const next =
                              (index +
                                (key === "ArrowLeft" ? -1 : 1) +
                                options.length) %
                              options.length;
                            onChange(options[next]!.value);
                            const target = event.currentTarget;
                            if (target instanceof HTMLElement)
                              target
                                .closest(
                                  `[role="${role === "radio" ? "radiogroup" : "tablist"}"]`,
                                )
                                ?.querySelectorAll<HTMLElement>(
                                  `[role="${role}"]`,
                                )
                                [next]?.focus();
                          }
                        }
                      : undefined
                  }
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.selected,
                    (pressed || disabled) && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.label, selected && styles.selectedLabel]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}
const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 4 },
  scroll: { flex: 1, minWidth: 0, flexGrow: 1 },
  options: { flexDirection: "row", alignItems: "center", gap: 4 },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: appRadius.control,
  },
  selected: { backgroundColor: appColors.primary },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: appColors.body,
  },
  selectedLabel: { fontFamily: fonts.bold, color: appColors.white },
  pressed: { opacity: 0.65 },
  action: { flexShrink: 0 },
});
