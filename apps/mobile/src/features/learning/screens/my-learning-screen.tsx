import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreenLayout } from "@/features/shell";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

const tabs = [
  {
    value: "requests",
    label: "Yêu cầu học",
    notice: "Danh sách yêu cầu học đã đăng chưa được kết nối.",
  },
  {
    value: "paths",
    label: "Lộ trình",
    notice: "Lộ trình học và dạy chưa được kết nối.",
  },
] as const;
type LearningTab = (typeof tabs)[number]["value"];

export function MyLearningScreen() {
  const [tab, setTab] = useState<LearningTab>("requests");
  const current = tabs.find((item) => item.value === tab)!;
  return (
    <AppScreenLayout
      title="Hành trình của tôi"
      selected="Hồ sơ"
      back={{ href: "/profile", label: "Quay lại hồ sơ" }}
    >
      {() => (
        <View style={styles.content}>
          <View
            style={styles.tabs}
            accessibilityRole="tablist"
            accessibilityLabel="Yêu cầu học và lộ trình"
          >
            {tabs.map((item) => {
              const selected = item.value === tab;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  aria-selected={selected}
                  onPress={() => setTab(item.value)}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.tabLabel, selected && styles.selectedLabel]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.notice}>
              <Text accessibilityRole="header" style={styles.title}>
                {current.label}
              </Text>
              <Text style={styles.caption}>{current.notice}</Text>
            </View>
          </ScrollView>
        </View>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceInset,
    borderRadius: appRadius.control,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: appRadius.control,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  tabLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.muted,
    textAlign: "center",
  },
  selectedLabel: { color: colors.primary },
  scroll: { paddingBottom: 24 },
  notice: {
    padding: 24,
    gap: 8,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
