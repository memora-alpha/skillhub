import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { appColors, fonts, typography } from "@/constants/theme";

const tabs = [
  { value: "library", label: "Thư viện" },
  { value: "posted", label: "Đã đăng" },
  { value: "saved", label: "Đã lưu" },
] as const;
export type MyMaterialTab = (typeof tabs)[number]["value"];
export function myMaterialTab(value?: string): MyMaterialTab {
  return value === "posted" || value === "saved" ? value : "library";
}
export function MyMaterialTabs({
  value,
  onChange,
}: Readonly<{
  value: MyMaterialTab;
  onChange: (tab: MyMaterialTab) => void;
}>) {
  return (
    <View
      style={styles.tabs}
      accessibilityRole="tablist"
      accessibilityLabel="Tài liệu của tôi"
    >
      {tabs.map((tab, index) => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.value }}
          aria-selected={value === tab.value}
          onPress={() => onChange(tab.value)}
          onKeyDown={
            Platform.OS === "web"
              ? (event) => {
                  const key = event.nativeEvent.key;
                  if (key === " " || key === "Spacebar") {
                    event.preventDefault();
                    onChange(tab.value);
                  } else if (key === "ArrowLeft" || key === "ArrowRight") {
                    event.preventDefault();
                    const next =
                      (index + (key === "ArrowLeft" ? -1 : 1) + tabs.length) %
                      tabs.length;
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
            value === tab.value && styles.active,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.label, value === tab.value && styles.activeLabel]}
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  active: { borderBottomColor: appColors.primary },
  label: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: appColors.muted,
    textAlign: "center",
  },
  activeLabel: { fontFamily: fonts.bold, color: appColors.primary },
  pressed: { opacity: 0.7 },
});
