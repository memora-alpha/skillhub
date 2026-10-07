import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { shadows } from "@/constants/shadows";
import {
  typography,
  iconSizes,
  fonts,
} from "@/constants/theme";
import { useMockSession } from "@/features/auth";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileHero } from "../components/ProfileHero";
import {
  ProfileSection,
  ProfileHeading,
  VerifiedBadge,
  profileStyles,
} from "../components/ProfilePrimitives";
import { profileActions, profileDetails } from "../mocks/profile";
import {
  profileActionTints,
  profileColors,
  profileShadows,
  profileStatColors,
} from "../constants/theme";

export function ProfileScreen() {
  const { session } = useMockSession();
  const router = useRouter();
  const compact = useWindowDimensions().width < 360;
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  if (!session) return <Redirect href="/login" />;
  return (
    <ProfileLayout session={session}>
      {(open) => (
        <View style={styles.stack}>
          <View style={styles.heroCard}>
            <ProfileHero
              name={session.name}
              userId={session.userId}
              onEdit={() => router.push("/edit-profile")}
            />
            <View style={styles.stats}>
              {profileDetails.stats.map((stat, index) => (
                <View
                  key={stat.label}
                  style={[styles.stat, compact && { paddingHorizontal: 6 }]}
                >
                  <Text
                    style={[
                      styles.statValue,
                      { color: profileStatColors[index] },
                    ]}
                  >
                    {stat.value}
                  </Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            {profileActions.map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => open(action.label)}
                onHoverIn={() => setHoveredAction(action.label)}
                onHoverOut={() => setHoveredAction(null)}
                style={({ pressed }) => [
                  styles.action,
                  (pressed || hoveredAction === action.label) &&
                    styles.actionRaised,
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    {
                      backgroundColor:
                        profileActionTints[action.icon] ?? profileColors.neutral,
                    },
                  ]}
                >
                  <Icon
                    name={action.icon}
                    color={action.color}
                    size={iconSizes.control}
                    filled={false}
                  />
                </View>
                <Text style={[profileStyles.label, { flex: 1 }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ProfileSection>
            <Text accessibilityRole="header" style={profileStyles.heading}>
              Giới thiệu
            </Text>
            <Text style={profileStyles.body}>
              {session.bio ?? profileDetails.bio}
            </Text>
          </ProfileSection>
          <ProfileSection>
            <ProfileHeading
              title="Kỹ năng chia sẻ"
              action="Quản lý"
              onPress={() => open("Kỹ năng")}
            />
            <View style={{ gap: 2 }}>
              {profileDetails.sharingSkills.map((skill) => (
                <View key={skill.name} style={styles.skill}>
                  <View style={styles.skillName}>
                    <Text style={profileStyles.label}>{skill.name}</Text>
                    {skill.verified && <VerifiedBadge />}
                  </View>
                  <View style={styles.level}>
                    <Text style={styles.levelText}>{skill.level}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ProfileSection>
          <ProfileSection>
            <ProfileHeading
              title="Huy hiệu"
              action="Tất cả"
              onPress={() => open("Thành tích")}
            />
            <View style={styles.badges}>
              {profileDetails.badges.map((badge) => (
                <View
                  key={badge.label}
                  accessibilityLabel={badge.label}
                  style={styles.badge}
                >
                  <Icon
                    name={badge.icon}
                    size={iconSizes.feature}
                    color={badge.color}
                  />
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem thêm huy hiệu"
                onPress={() => open("Thành tích")}
                style={[
                  styles.badge,
                  {
                    borderWidth: 0,
                    backgroundColor: profileColors.neutral,
                  },
                ]}
              >
                <Icon
                  name="plus"
                  size={iconSizes.control}
                  color={profileColors.muted}
                />
              </Pressable>
            </View>
          </ProfileSection>
          <Pressable
            accessibilityRole="button"
            onPress={() => open("Thông tin riêng tư")}
            style={styles.private}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: profileColors.neutral },
              ]}
            >
              <Icon
                name="lock"
                size={iconSizes.control}
                color={profileColors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={profileStyles.label}>Thông tin riêng tư</Text>
              <Text style={profileStyles.caption}>
                Email, số điện thoại, ngày sinh
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </ProfileLayout>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  heroCard: {
    padding: 16,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: profileColors.border,
    backgroundColor: profileColors.surface,
    boxShadow: profileShadows.hero,
  },
  stats: {
    flexDirection: "row",
    gap: 2,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
    alignItems: "center",
    borderRadius: 0,
  },
  statValue: {
    fontFamily: fonts.bold,
    ...typography.body,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.muted,
    includeFontPadding: false,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    minHeight: 56,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: profileColors.surface,
    borderWidth: 1,
    borderColor: profileColors.border,
    boxShadow: profileShadows.action,
  },
  actionRaised: {
    ...shadows.sm,
    boxShadow: profileShadows.actionRaised,
    transform: [{ translateY: -1 }],
  },
  actionIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 7,
    backgroundColor: profileColors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
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
    borderRadius: 7,
    backgroundColor: profileColors.neutral,
  },
  levelText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: profileColors.mutedStrong,
    includeFontPadding: false,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: profileColors.badge,
    borderWidth: 1,
    borderColor: profileColors.badgeBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  private: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: profileColors.border,
    backgroundColor: profileColors.surface,
  },
});
