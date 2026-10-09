import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProfileHero } from "./ProfileHero";
import {
  ProfileSection,
  ProfileHeading,
  VerifiedBadge,
  profileStyles,
} from "./ProfilePrimitives";
import {
  profileColors,
  profileShadows,
  profileStatColors,
} from "../constants/theme";
import { fonts, typography } from "@/constants/theme";
import type { PublicProfile, SkillLevel } from "../types/profile";

const levels: Record<SkillLevel, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  EXPERT: "Chuyên gia",
};

export function ProfileSummary({
  profile,
  onEdit,
  avatarNotice,
}: {
  profile: PublicProfile;
  onEdit?: () => void;
  avatarNotice?: ReactNode;
}) {
  const stats = [
    { value: profile.reputationScore, label: "Uy tín" },
    { value: profile.verifiedSkillCount, label: "Kỹ năng xác minh" },
  ];
  return (
    <View style={styles.heroCard}>
      <ProfileHero
        name={profile.fullName}
        userId={profile.userId}
        headline={profile.headline}
        avatarUrl={profile.avatarUrl}
        onEdit={onEdit}
      />
      {avatarNotice}
      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={styles.stat}>
            <Text
              selectable
              style={[styles.statValue, { color: profileStatColors[index] }]}
            >
              {stat.value ?? "-"}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProfileAbout({ bio }: { bio: string }) {
  return (
    <ProfileSection>
      <ProfileHeading title="Giới thiệu" />
      <Text selectable style={profileStyles.body}>
        {bio.trim() ? bio : "Chưa có giới thiệu."}
      </Text>
    </ProfileSection>
  );
}

export function ProfileSkills({
  profile,
  onManage,
  available = true,
}: {
  profile: PublicProfile;
  onManage?: () => void;
  available?: boolean;
}) {
  return (
    <ProfileSection>
      <ProfileHeading
        title="Kỹ năng chia sẻ"
        action={onManage ? "Quản lý" : undefined}
        onPress={onManage}
      />
      {!available ? (
        <Text style={profileStyles.caption}>
          Danh sách kỹ năng chưa được kết nối.
        </Text>
      ) : profile.sharingSkills.length === 0 ? (
        <Text style={profileStyles.caption}>Chưa có kỹ năng chia sẻ.</Text>
      ) : (
        profile.sharingSkills.map((skill) => (
          <View key={skill.id} style={styles.skill}>
            <View style={styles.skillName}>
              <Text selectable style={profileStyles.label}>
                {skill.name}
              </Text>
              {skill.verificationStatus === "VERIFIED" && <VerifiedBadge />}
            </View>
            <View style={styles.level}>
              <Text style={styles.levelText}>{levels[skill.level]}</Text>
            </View>
          </View>
        ))
      )}
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 16,
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: profileColors.border,
    backgroundColor: profileColors.surface,
    boxShadow: profileShadows.hero,
  },
  stats: { flexDirection: "row", gap: 6 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 2, alignItems: "center" },
  statValue: {
    fontFamily: fonts.bold,
    ...typography.body,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.muted,
    textAlign: "center",
    includeFontPadding: false,
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    paddingVertical: 5,
    gap: 6,
  },
  skillName: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flexShrink: 1,
  },
  level: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: profileColors.neutral,
  },
  levelText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.mutedStrong,
    includeFontPadding: false,
  },
});
