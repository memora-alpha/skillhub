import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";
import { Icon, type IconName } from "@/components/Icon";
import { appRadius, typography, fonts } from "@/constants/theme";
import { homeColors as colors } from "../constants/theme";
import { homeStyles } from "./HomePrimitives";

const shortcuts: { label: string; icon: IconName; href: Href }[] = [
  { label: "Hoàn thiện hồ sơ", icon: "user", href: "/edit-profile" },
  { label: "Thêm kỹ năng chia sẻ", icon: "award", href: "/my-skills/new" },
  { label: "Khám phá kỹ năng", icon: "search", href: "/search" },
  { label: "Tạo yêu cầu học", icon: "edit", href: "/requests/new" },
];

export function NewUserGuide({
  onNavigate,
}: {
  onNavigate: (href: Href) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.guide}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hướng dẫn người mới"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.heading, pressed && { opacity: 0.7 }]}
      >
        <Icon name="book" size={22} color={colors.orange} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={homeStyles.label}>Bắt đầu cùng SkillHub</Text>
          <Text style={homeStyles.caption}>
            Chuẩn bị hồ sơ và tìm cơ hội học tập.
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? "45deg" : "0deg" }] }}>
          <Icon name="plus" size={18} color={colors.orange} />
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.tasks}>
          {shortcuts.map((task) => (
            <Pressable
              key={task.label}
              accessibilityRole="button"
              accessibilityLabel={task.label}
              onPress={() => onNavigate(task.href)}
              style={({ pressed }) => [
                styles.task,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name={task.icon} size={20} color={colors.orange} />
              <Text style={styles.taskLabel}>{task.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  guide: { backgroundColor: colors.orangeSoft, borderRadius: appRadius.card },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  tasks: { gap: 4, paddingHorizontal: 16, paddingBottom: 12 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  taskLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    ...typography.body,
    color: colors.ink,
  },
});
