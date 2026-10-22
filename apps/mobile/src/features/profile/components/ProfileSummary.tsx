import type { ReactNode } from "react";
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
import type { PublicProfile } from "../types/profile";

export function ProfileSummary({
  profile,
  onEdit,
  avatarNotice,
}: Readonly<{
  profile: PublicProfile;
  onEdit?: () => void;
  avatarNotice?: ReactNode;
}>) {
  const stats = [
    { value: profile.reputationScore, label: "Điểm uy tín" },
    { value: profile.verifiedSkillCount, label: "Kỹ năng đã xác minh" },
    { value: null, label: "Learning Path hoàn thành", pending: true },
  ];
  return (
    <View style={styles.heroCard}>
      <ProfileHero
        name={profile.fullName}
        userId={profile.userId}
        headline={profile.headline}
        avatarUrl={profile.avatarUrl}
        selectedTitle={profile.selectedTitle}
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

export function ProfileAbout({ bio }: Readonly<{ bio: string }>) {
  return (
    <ProfileSection>
      <ProfileHeading title="Giới thiệu" />
      <Text selectable style={profileStyles.body}>
        {bio.trim() ? bio : "Chưa có giới thiệu."}
      </Text>
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
});
