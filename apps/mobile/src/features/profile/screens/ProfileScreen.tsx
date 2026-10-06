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
import { colors, fonts, radius } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileHero } from "../components/ProfileHero";
import {
  ProfileSection,
  ProfileHeading,
  VerifiedBadge,
  profileStyles,
} from "../components/ProfilePrimitives";
import { profileActions, profileDetails } from "../mocks/profile";

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
          <ProfileHero
            name={session.name}
            onEdit={() => router.push("/edit-profile")}
          />
          <View style={styles.stats}>
            {profileDetails.stats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.stat, compact && { paddingHorizontal: 6 }]}
              >
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
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
                <View style={styles.actionIcon}>
                  <Icon
                    name={action.icon}
                    color={action.color}
                    size={18}
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
            <Text
              accessibilityRole="header"
              style={[profileStyles.heading, { marginBottom: 8 }]}
            >
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
            <View style={{ gap: 8 }}>
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
                  <Icon name={badge.icon} size={24} color={badge.color} />
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem thêm huy hiệu"
                onPress={() => open("Thành tích")}
                style={[
                  styles.badge,
                  { borderWidth: 0, backgroundColor: colors.sand },
                ]}
              >
                <Icon name="plus" size={20} color={colors.muted} />
              </Pressable>
            </View>
          </ProfileSection>
          <Pressable
            accessibilityRole="button"
            onPress={() => open("Thông tin riêng tư")}
            style={styles.private}
          >
            <View style={styles.actionIcon}>
              <Icon name="lock" size={18} color={colors.muted} />
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
  stack: { gap: 16 },
  stats: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.brand,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
    includeFontPadding: false,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    flexBasis: "45%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    minHeight: 56,
    borderRadius: radius.control,
    backgroundColor: colors.white,
    ...shadows.sm,
    boxShadow: "0 1px 3px rgba(28, 20, 16, 0.06)",
  },
  actionRaised: {
    ...shadows.md,
    boxShadow: "0 6px 14px rgba(28, 20, 16, 0.12)",
    transform: [{ translateY: -1 }],
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: colors.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    paddingVertical: 8,
    gap: 8,
  },
  skillName: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flexShrink: 1,
  },
  level: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.badge,
    backgroundColor: colors.sand,
  },
  levelText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
    includeFontPadding: false,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  private: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
});
