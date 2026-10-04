import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ProgressBar";
import { colors, fonts } from "@/constants/theme";
import { HomeCard, SectionHeading, homeStyles } from "./HomePrimitives";
import {
  newUserSummary,
  onboardingTasks,
  popularSkills,
  quickActions,
} from "../mocks/home";

export function NewHomeContent({
  name,
  onAction,
}: {
  name: string;
  onAction: (title: string) => void;
}) {
  const completed = onboardingTasks.filter((task) => task.done).length;
  return (
    <View style={homeStyles.stack}>
      <LinearGradient
        colors={[colors.brand, colors.brandHover]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.greeting}
      >
        <Text style={styles.salutation}>Chào buổi sáng ☀️</Text>
        <Text style={styles.name}>{name}!</Text>
        <Text style={[styles.salutation, { marginTop: 4 }]}>
          Bạn mới tham gia SkillHub. Hãy bắt đầu nhé!
        </Text>
        <View style={styles.balances}>
          <View>
            <Text style={styles.balanceLabel}>Credit</Text>
            <Text style={styles.balance}>{newUserSummary.credit} CR</Text>
          </View>
          <View style={styles.separator} />
          <View>
            <Text style={styles.balanceLabel}>Reputation</Text>
            <Text style={styles.balance}>{newUserSummary.reputation} RP</Text>
          </View>
        </View>
      </LinearGradient>
      <HomeCard>
        <View style={[homeStyles.row, { marginBottom: 16 }]}>
          <Text accessibilityRole="header" style={homeStyles.heading}>
            Bắt đầu với SkillHub
          </Text>
          <Text style={homeStyles.link}>
            {completed}/{onboardingTasks.length}
          </Text>
        </View>
        <ProgressBar
          value={completed}
          max={onboardingTasks.length}
          label="Bắt đầu với SkillHub"
        />
        <View style={styles.tasks}>
          {onboardingTasks.map((task) => (
            <Pressable
              key={task.label}
              accessibilityRole="button"
              onPress={() => onAction(task.label)}
              style={({ pressed }) => [
                styles.task,
                pressed && { backgroundColor: colors.cream },
              ]}
            >
              <View
                style={[
                  styles.taskIcon,
                  {
                    backgroundColor: task.done
                      ? colors.successLight
                      : colors.sand,
                  },
                ]}
              >
                {task.done ? (
                  <Icon name="check-circle" size={16} color={colors.success} />
                ) : (
                  <Text style={styles.emoji}>{task.icon}</Text>
                )}
              </View>
              <Text
                style={[
                  homeStyles.label,
                  styles.taskLabel,
                  task.done && styles.done,
                ]}
              >
                {task.label}
              </Text>
              {!task.done && (
                <Icon name="chevron" size={16} color={colors.mutedLight} />
              )}
            </Pressable>
          ))}
        </View>
      </HomeCard>
      <View>
        <SectionHeading title="Khám phá" />
        <View style={styles.actions}>
          {quickActions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => onAction(action.label)}
              style={({ pressed }) => [
                styles.action,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: action.background },
                ]}
              >
                <Icon name={action.icon} color={action.color} size={22} />
              </View>
              <Text style={homeStyles.label}>{action.label}</Text>
              <Text style={[homeStyles.caption, { marginTop: 2 }]}>
                {action.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View>
        <SectionHeading
          title="Kỹ năng phổ biến"
          action="Xem thêm"
          onPress={() => onAction("Kỹ năng phổ biến")}
        />
        <View style={styles.tags}>
          {popularSkills.map((skill) => (
            <Pressable
              key={skill}
              accessibilityRole="button"
              onPress={() => onAction(skill)}
              style={styles.tag}
            >
              <Text style={styles.tagLabel}>{skill}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  greeting: { padding: 24, borderRadius: 24 },
  salutation: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFFCC",
    includeFontPadding: false,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    marginTop: 4,
    color: colors.white,
    includeFontPadding: false,
  },
  balances: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 16,
  },
  separator: { width: 1, height: 32, backgroundColor: "#FFFFFF4D" },
  balanceLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: "#FFFFFFB3",
    includeFontPadding: false,
  },
  balance: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
    includeFontPadding: false,
  },
  tasks: { gap: 8, marginTop: 16 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  taskIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 14 },
  taskLabel: { flex: 1, fontFamily: fonts.medium },
  done: { textDecorationLine: "line-through", color: colors.mutedLight },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: colors.sand,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
    includeFontPadding: false,
  },
});
