import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { skillBadgeColors, fonts, typography } from "@/constants/theme";
import { badgeLabels, type SkillBadge } from "../types/skills";

const tones: Record<
  SkillBadge,
  { icon: IconName; color: string; background: string; border: string }
> = {
  VERIFIED: {
    icon: "shield",
    ...skillBadgeColors.VERIFIED,
  },
  UNVERIFIED: { icon: "clock", ...skillBadgeColors.UNVERIFIED },
  PENDING: {
    icon: "clock",
    ...skillBadgeColors.PENDING,
  },
  REJECTED: {
    icon: "alert",
    ...skillBadgeColors.REJECTED,
  },
};
export function VerificationBadge({
  status,
  compact = false,
}: {
  status: SkillBadge;
  compact?: boolean;
}) {
  const tone = tones[status];
  return (
    <View
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: tone.background, borderColor: tone.border },
      ]}
    >
      <Icon name={tone.icon} size={compact ? 10 : 14} color={tone.color} />
      <Text
        style={[
          styles.label,
          compact && styles.compactLabel,
          { color: tone.color },
        ]}
      >
        {compact && status === "VERIFIED" ? "Xác minh" : badgeLabels[status]}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  label: { ...typography.secondary, fontFamily: fonts.semibold },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    gap: 4,
    borderRadius: 6,
  },
  compactLabel: { fontSize: 10, lineHeight: 14 },
});
