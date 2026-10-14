import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  fonts,
  skillLevelColors,
} from "@/constants/theme";
import { badgeLabels, type SkillBadge } from "../types/skills";
import { SkillAction } from "./SkillAction";
import { VerificationBadge } from "./VerificationBadge";

export function ProfileSkillSection({
  children,
  onManage,
}: Readonly<{
  children: ReactNode;
  onManage?: () => void;
}>) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>
          Kỹ năng chia sẻ
        </Text>
        {onManage && <SkillAction label="Quản lý" onPress={onManage} />}
      </View>
      <View>{children}</View>
    </View>
  );
}

export function ProfileSkillRow({
  name,
  level,
  status,
  isVisible,
  onPress,
}: Readonly<{
  name: string;
  level: string;
  status: SkillBadge;
  isVisible?: boolean;
  onPress?: () => void;
}>) {
  const content = (
    <>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text selectable={!onPress} style={styles.name}>
            {name}
          </Text>
          {status !== "UNVERIFIED" && (
            <VerificationBadge status={status} compact />
          )}
        </View>
        {isVisible === false && <Text style={styles.private}>Riêng tư</Text>}
      </View>
      <View style={styles.levelBadge}>
        <Text style={styles.level}>{level}</Text>
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem kỹ năng: ${name}`}
      accessibilityHint={`${level}. ${badgeLabels[status]}${isVisible === false ? ". Riêng tư" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}
export function ProfileSkillMore({
  busy = false,
  onPress,
}: Readonly<{
  busy?: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Xem thêm"
      accessibilityHint="Hiện thêm 5 kỹ năng"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed || busy ? 0.55 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 13,
          lineHeight: 18,
          color: colors.primary,
        }}
      >
        {busy ? "Đang tải…" : "Xem thêm"}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: colors.ink,
    flexShrink: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 48,
    gap: 10,
  },
  pressed: { backgroundColor: colors.surfaceLow },
  content: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flexShrink: 1,
  },
  levelBadge: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: skillLevelColors.border,
    backgroundColor: skillLevelColors.background,
  },
  level: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: skillLevelColors.color,
  },
  private: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
