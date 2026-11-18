import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export const reviewTabs = [
  { value: "received", label: "Nhận được" },
  { value: "sent", label: "Đã gửi" },
  { value: "write", label: "Viết đánh giá" },
] as const;
export type ReviewTab = (typeof reviewTabs)[number]["value"];

export function ReviewTabs({
  value,
  onChange,
}: Readonly<{ value: ReviewTab; onChange: (tab: ReviewTab) => void }>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Danh sách đánh giá"
      style={styles.tabs}
    >
      {reviewTabs.map((tab, index) => (
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
                      (index +
                        (key === "ArrowLeft" ? -1 : 1) +
                        reviewTabs.length) %
                      reviewTabs.length;
                    onChange(reviewTabs[next]!.value);
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
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: colors.primary },
  pressed: { opacity: 0.7 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.muted,
    textAlign: "center",
  },
  selectedLabel: { color: colors.primary, fontFamily: fonts.bold },
});
