import { useId, type Ref } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export type FilterControlProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};
type Props = FilterControlProps & {
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  triggerRef?: Ref<View>;
};

// An inline disclosure card requested by the user, not a platform select/popup.
export function HistoryFilterCard({
  label,
  value,
  options,
  onChange,
  expanded,
  onToggle,
  onClose,
  triggerRef,
}: Props) {
  const optionsId = useId();
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    "Chọn loại giao dịch";
  return (
    <View style={styles.card} onAccessibilityEscape={onClose}>
      <Pressable
        ref={triggerRef}
        testID="wallet-history-filter-trigger"
        accessibilityRole="button"
        accessibilityLabel={label + ": " + selectedLabel}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        aria-controls={expanded ? optionsId : undefined}
        onPress={onToggle}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Icon name="filter" color={colors.primaryDark} size={20} />
        </View>
        <View style={styles.text}>
          <Text style={styles.caption}>Loại giao dịch</Text>
          <Text style={styles.value}>{selectedLabel}</Text>
        </View>
        <View
          style={{ transform: [{ rotate: expanded ? "-90deg" : "90deg" }] }}
        >
          <Icon name="chevron" color={colors.body} size={18} />
        </View>
      </Pressable>
      {expanded && (
        <View
          nativeID={optionsId}
          testID="wallet-history-filter-options"
          style={styles.options}
        >
          {options.map((option, index) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                aria-pressed={selected}
                onPress={() => {
                  onChange(option.value);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.separator,
                  selected && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.optionLabel, selected && styles.selectedLabel]}
                >
                  {option.label}
                </Text>
                <View style={styles.mark}>
                  {selected && (
                    <Icon name="check" size={18} color={colors.primaryDark} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 64,
  },
  icon: {
    padding: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: appRadius.control,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  caption: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.body,
  },
  value: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  options: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.primarySoft },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.medium,
    ...typography.body,
    color: colors.ink,
  },
  selectedLabel: { fontFamily: fonts.bold, color: colors.primaryDark },
  mark: { width: 18 },
  pressed: { opacity: 0.7 },
});
