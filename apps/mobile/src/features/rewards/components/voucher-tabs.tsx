import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { appColors, fonts, typography } from "@/constants/theme";

const tabs = [
  { value: "catalog", label: "Khám phá" },
  { value: "mine", label: "Của tôi" },
] as const;
type VoucherTab = (typeof tabs)[number]["value"];
export function VoucherTabs({
  value,
  onChange,
}: Readonly<{ value: VoucherTab; onChange: (value: VoucherTab) => void }>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Mục voucher"
      style={styles.tabs}
    >
      {tabs.map((tab, index) => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: value === tab.value }}
          aria-selected={value === tab.value}
          onPress={() => onChange(tab.value)}
          onKeyDown={
            Platform.OS === "web"
              ? (event) => {
                  const key = event.nativeEvent.key;
                  if (key === " " || key === "Spacebar" || key === "Enter") {
                    event.preventDefault();
                    onChange(tab.value);
                  } else if (key === "ArrowLeft" || key === "ArrowRight") {
                    event.preventDefault();
                    const next = (index + 1) % tabs.length;
                    onChange(tabs[next]!.value);
                    const target = event.currentTarget;
                    if (target instanceof HTMLElement)
                      target
                        .closest('[role="tablist"]')
                        ?.querySelectorAll<HTMLElement>('[role="tab"]')
                        [next]?.focus();
                  }
                }
              : undefined
          }
          style={({ pressed }) => [
            styles.tab,
            value === tab.value && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.label, value === tab.value && styles.selectedLabel]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: appColors.primary },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: appColors.muted,
  },
  selectedLabel: { fontFamily: fonts.bold, color: appColors.primary },
  pressed: { opacity: 0.7 },
});
