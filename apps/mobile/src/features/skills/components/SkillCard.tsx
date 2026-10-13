import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  fonts,
  typography,
  signedInChrome,
  skillLevelColors,
} from "@/constants/theme";
import {
  levelLabels,
  badgeLabels,
  type PublicSkill,
  type OwnSkill,
} from "../types/skills";
import { VerificationBadge } from "./VerificationBadge";
import { hasPendingVerification } from "../utils/verification-state";

export function SkillCard({
  skill,
  onPress,
  detail = false,
}: Readonly<{
  skill: PublicSkill | OwnSkill;
  onPress?: () => void;
  detail?: boolean;
}>) {
  const own = "isVisible" in skill ? skill : null;
  if (own?.archivedAt) return null;
  let visibility: string | null = null;
  if (own) visibility = own.isVisible ? "Công khai" : "Riêng tư";
  const visibilityHint = visibility ? `. ${visibility}` : "";
  const content = (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          selectable={!onPress}
          style={[styles.name, detail && styles.detailName]}
        >
          {skill.skill.name}
        </Text>
        <View style={styles.levelBadge}>
          <Text style={styles.level}>{levelLabels[skill.level]}</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <VerificationBadge status={skill.verificationStatus} />
        {own &&
          hasPendingVerification(own) &&
          skill.verificationStatus !== "PENDING" && (
            <VerificationBadge status="PENDING" />
          )}
        {visibility && <Text style={styles.caption}>{visibility}</Text>}
      </View>
      <Text
        selectable={!onPress}
        numberOfLines={detail ? undefined : 2}
        style={styles.description}
      >
        {skill.description}
      </Text>
      {skill.experienceYears !== null && (
        <Text style={styles.caption}>
          {skill.experienceYears} năm kinh nghiệm · tự khai
        </Text>
      )}
      {detail && skill.skill.status !== "ACTIVE" && (
        <Text style={styles.caption}>
          Kỹ năng không còn hoạt động trong danh mục.
        </Text>
      )}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem kỹ năng: ${skill.skill.name}`}
      accessibilityHint={`${levelLabels[skill.level]}. ${badgeLabels[skill.verificationStatus]}${visibilityHint}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.card}>{content}</View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceLow },
  content: { gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
    flex: 1,
  },
  detailName: { ...typography.title },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: skillLevelColors.border,
    backgroundColor: skillLevelColors.background,
    flexShrink: 0,
  },
  level: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: skillLevelColors.color,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  description: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  caption: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
