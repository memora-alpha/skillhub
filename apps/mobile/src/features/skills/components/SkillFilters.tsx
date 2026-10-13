import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { SkillFilter } from "../utils/skill-filter";

const options: { value: SkillFilter; label: string; icon: IconName }[] = [
  { value: "ALL", label: "Tất cả", icon: "book" },
  { value: "VERIFIED", label: "Đã xác minh", icon: "shield" },
  { value: "PENDING", label: "Đang chờ xác minh", icon: "clock" },
  { value: "UNVERIFIED", label: "Chưa xác minh", icon: "clock" },
];
export function SkillFilters({
  value,
  onChange,
}: Readonly<{
  value: SkillFilter;
  onChange: (value: SkillFilter) => void;
}>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.selected,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                name={option.icon}
                size={15}
                color={selected ? colors.primary : colors.muted}
              />
              <Text
                style={[styles.label, selected && { color: colors.primary }]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { paddingRight: 2 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
});
