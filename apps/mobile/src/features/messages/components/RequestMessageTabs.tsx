import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

const tabs = [
  { value: "received", label: "Đề xuất nhận được" },
  { value: "chats", label: "Đoạn chat" },
] as const;
export type RequestMessageTab = (typeof tabs)[number]["value"];

export function RequestMessageTabs({
  value,
  onChange,
  direction = "received",
}: Readonly<{
  value: RequestMessageTab;
  onChange: (value: RequestMessageTab) => void;
  direction?: "sent" | "received" | "unknown";
}>) {
  let proposalLabel = "Đề xuất";
  if (direction === "received") proposalLabel = "Đề xuất nhận được";
  else if (direction === "sent") proposalLabel = "Đề xuất đã gửi";
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Nội dung yêu cầu học"
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
            {tab.value === "received" ? proposalLabel : tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
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
