import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import {
  requestFormColors as colors,
  requestFormStyles as styles,
} from "./request-form.styles";

export function RequestMultiSelect({
  value,
  options,
  onChange,
  disabled = false,
  error,
  showOptions = true,
  selectionLabels = options,
  showSelection = true,
}: Readonly<{
  value: string[];
  options: { id: string; label: string }[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
  showOptions?: boolean;
  selectionLabels?: { id: string; label: string }[];
  showSelection?: boolean;
}>) {
  const names = new Map(
    selectionLabels.map((option) => [option.id, option.label]),
  );
  return (
    <View style={{ gap: 8 }}>
      {showSelection && (
        <View style={styles.badgeList}>
          {value.map((id, index) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              hitSlop={4}
              disabled={disabled}
              accessibilityState={{ disabled }}
              accessibilityLabel={`Bỏ ${names.get(id) ?? "mục đã chọn " + (index + 1)}`}
              onPress={() =>
                onChange(value.filter((selected) => selected !== id))
              }
              style={[styles.chip, disabled && { opacity: 0.6 }]}
            >
              <Text style={[styles.choiceLabel, { color: colors.primary }]}>
                {names.get(id) ?? `Mục đã chọn ${index + 1} · Chưa có tên`}
              </Text>
              <Icon name="close" size={14} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      )}
      {showSelection && <Copy muted>{value.length}/10 đã chọn</Copy>}
      {showOptions && (
        <View style={styles.badgeList}>
          {options
            .filter((option) => !value.includes(option.id))
            .map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="checkbox"
                hitSlop={4}
                accessibilityLabel={option.label}
                accessibilityState={{
                  checked: false,
                  disabled: disabled || value.length >= 10,
                }}
                disabled={disabled || value.length >= 10}
                onPress={() => onChange([...value, option.id])}
                style={[
                  styles.choiceBadge,
                  (disabled || value.length >= 10) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.choiceLabel}>{option.label}</Text>
                <Icon name="plus" size={13} color={colors.muted} />
              </Pressable>
            ))}
        </View>
      )}
      {showSelection && !!value.length && (
        <Button
          variant="ghost"
          disabled={disabled}
          onPress={() => onChange([])}
        >
          Bỏ tất cả lựa chọn
        </Button>
      )}
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </View>
  );
}
