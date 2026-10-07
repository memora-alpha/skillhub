import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { typography, fonts } from "@/constants/theme";
import { homeColors as colors } from "../constants/theme";
import { onboardingTasks } from "../mocks/home";
import { homeStyles } from "./HomePrimitives";

export function NewUserGuide({
  onAction,
}: {
  onAction: (title: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completed = onboardingTasks.filter((task) => task.done).length;
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
          <Text style={homeStyles.label}>Hướng dẫn người mới</Text>
          <Text style={homeStyles.caption}>
            {completed}/{onboardingTasks.length} bước đã hoàn thành
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? "45deg" : "0deg" }] }}>
          <Icon name="plus" size={18} color={colors.orange} />
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.tasks}>
          {onboardingTasks.map((task) => (
            <Pressable
              key={task.label}
              accessibilityRole="button"
              accessibilityLabel={`${task.label}${task.done ? ", đã hoàn thành" : ""}`}
              onPress={() => onAction(task.label)}
              style={({ pressed }) => [
                styles.task,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                name={task.done ? "check-circle" : task.icon}
                size={20}
                color={task.done ? colors.green : colors.orange}
              />
              <Text
                style={[styles.taskLabel, task.done && { color: colors.muted }]}
              >
                {task.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  guide: { backgroundColor: colors.orangeSoft, borderRadius: 16 },
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
