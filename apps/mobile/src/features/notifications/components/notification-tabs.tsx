import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export type NotificationFilter = "Tất cả" | "Chưa đọc";

export function NotificationTabs({
  value,
  onChange,
  unreadCount,
  hasMore,
}: {
  value: NotificationFilter;
  onChange: (value: NotificationFilter) => void;
  unreadCount: number;
  hasMore: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      {(["Tất cả", "Chưa đọc"] as const).map((option) => {
        const selected = value === option;
        const unread = option === "Chưa đọc";
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={
              unread
                ? `Chưa đọc, ${unreadCount} thông báo trong danh sách đã tải`
                : "Tất cả thông báo"
            }
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {option}
            </Text>
            {unread && unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.count}>
                  {unreadCount > 99
                    ? "99+"
                    : `${unreadCount}${hasMore ? "+" : ""}`}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", alignItems: "stretch", gap: 16 },
  tab: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selected: { borderBottomColor: colors.primary },
  pressed: { opacity: 0.7 },
  label: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  selectedLabel: { fontFamily: fonts.bold, color: colors.ink },
  badge: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  count: { fontFamily: fonts.bold, ...typography.caption, color: colors.white },
});
