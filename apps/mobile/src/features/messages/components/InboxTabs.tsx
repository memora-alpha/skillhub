import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

const tabs = [
  { value: "requests", label: "Theo yêu cầu học" },
  { value: "direct", label: "Trao đổi trực tiếp" },
] as const;
export type InboxTab = (typeof tabs)[number]["value"];

export function InboxTabs({
  value,
  onChange,
}: Readonly<{
  value: InboxTab;
  onChange: (value: InboxTab) => void;
}>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Loại trao đổi"
      style={styles.tabs}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.value }}
          aria-selected={value === tab.value}
          onPress={() => onChange(tab.value)}
          style={[styles.tab, value === tab.value && styles.selected]}
        >
          <Text style={[styles.label, value === tab.value && styles.active]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: appRadius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
    textAlign: "center",
  },
  selected: {
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
  },
  active: { color: colors.primary, fontFamily: fonts.bold },
});
