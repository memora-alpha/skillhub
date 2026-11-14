import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function DiscoverTabs({
  materials,
  onChange,
}: Readonly<{ materials: boolean; onChange: (materials: boolean) => void }>) {
  const [hovered, setHovered] = useState<boolean>();
  const [focused, setFocused] = useState<boolean>();
  return (
    <View style={styles.tabs}>
      {([false, true] as const).map((value) => {
        const active = materials === value;
        const highlighted = active || hovered === value || focused === value;
        return (
          <Pressable
            key={String(value)}
            accessibilityRole="tab"
            accessibilityLabel={
              value ? "Khám phá tài liệu" : "Khám phá yêu cầu học"
            }
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onHoverIn={() => setHovered(value)}
            onHoverOut={() => setHovered(undefined)}
            onFocus={() => setFocused(value)}
            onBlur={() => setFocused(undefined)}
            onPress={() => {
              if (!active) onChange(value);
            }}
            style={({ pressed }) => [
              styles.tab,
              highlighted && styles.underline,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, highlighted && styles.activeLabel]}>
              {value ? "Tài liệu" : "Yêu cầu học"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 24,
  },
  tab: {
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 12,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  underline: { borderBottomColor: colors.primary },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.muted,
  },
  activeLabel: { color: colors.primary },
  pressed: { opacity: 0.65 },
});
