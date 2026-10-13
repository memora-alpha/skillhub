import type { ReactNode } from "react";
import {
  ProfileSkillSection,
  SamplePublicSkillRow,
  ProfileSkillMore,
  useProfileSkillWindow,
} from "@/features/skills";
import { StyleSheet, Text, View } from "react-native";
import { ProfileHero } from "./ProfileHero";
import {
  ProfileSection,
  ProfileHeading,
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
    { value: profile.reputationScore, label: "Điểm uy tín" },
    { value: profile.verifiedSkillCount, label: "Kỹ năng đã xác minh" },
    { value: null, label: "Lộ trình hoàn thành", pending: true },
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
              style={[
                styles.statValue,
                {
                  color: stat.pending
                    ? profileColors.muted
                    : profileStatColors[index],
                },
              ]}
            >
              {stat.value ?? "—"}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.pending && <Text style={styles.statLabel}>Sắp có</Text>}
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
  const preview = useProfileSkillWindow({
    count: available ? profile.sharingSkills.length : 0,
  });
  return (
    <ProfileSkillSection onManage={onManage}>
      {!available ? (
        <Text style={profileStyles.caption}>
          Danh sách kỹ năng chưa được kết nối.
        </Text>
      ) : !profile.sharingSkills.length ? (
        <Text style={profileStyles.caption}>Chưa có kỹ năng chia sẻ.</Text>
      ) : (
        profile.sharingSkills
          .slice(0, preview.visible)
          .map((skill) => (
            <SamplePublicSkillRow
              key={skill.id}
              name={skill.name}
              level={levels[skill.level]}
              status={skill.verificationStatus}
              description={skill.description}
              experienceYears={skill.experienceYears}
            />
          ))
      )}
      {preview.hasMore && (
        <ProfileSkillMore onPress={() => void preview.showMore()} />
      )}
    </ProfileSkillSection>
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
});
