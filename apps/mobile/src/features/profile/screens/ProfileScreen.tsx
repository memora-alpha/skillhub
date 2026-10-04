import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileHero } from "../components/ProfileHero";
import {
  ProfileCard,
  ProfileHeading,
  VerifiedBadge,
  profileStyles,
} from "../components/ProfilePrimitives";
import { profileActions, profileDetails } from "../mocks/profile";

export function ProfileScreen() {
  const { session } = useMockSession();
  const router = useRouter();
  const compact = useWindowDimensions().width < 360;
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
              <ProfileCard
                key={stat.label}
                style={[styles.stat, compact && { paddingHorizontal: 6 }]}
              >
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </ProfileCard>
            ))}
          </View>
          <View style={styles.actions}>
            {profileActions.map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.label}
                onPress={() => open(action.label)}
                style={({ pressed }) => [
                  styles.action,
                  pressed && { opacity: 0.7 },
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
                <Icon name="chevron" size={14} color={colors.mutedLight} />
              </Pressable>
            ))}
          </View>
          <ProfileCard>
            <Text
              accessibilityRole="header"
              style={[profileStyles.heading, { marginBottom: 8 }]}
            >
              Giới thiệu
            </Text>
            <Text style={profileStyles.body}>
              {session.bio ?? profileDetails.bio}
            </Text>
          </ProfileCard>
          <ProfileCard>
            <ProfileHeading
              title="Kỹ năng chia sẻ"
              action="Quản lý"
              onPress={() => open("Kỹ năng")}
            />
            <View style={{ gap: 8 }}>
              {profileDetails.sharingSkills.map((skill, index) => (
                <View
                  key={skill.name}
                  style={[
                    styles.skill,
                    index < profileDetails.sharingSkills.length - 1 &&
                      styles.skillBorder,
                  ]}
                >
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
          </ProfileCard>
          <ProfileCard>
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
                  <Text style={{ fontSize: 24 }}>{badge.symbol}</Text>
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
          </ProfileCard>
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
            <Icon name="chevron" size={14} color={colors.mutedLight} />
          </Pressable>
        </View>
      )}
    </ProfileLayout>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 16 },
  stats: { flexDirection: "row", gap: 8, marginTop: -32, zIndex: 1 },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    alignItems: "center",
    boxShadow: "0 4px 6px -1px #0000001A, 0 2px 4px -2px #0000001A",
  },
  statValue: {
    fontFamily: fonts.displayBold,
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: {
    flexBasis: "45%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
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
  skillBorder: { borderBottomWidth: 1, borderColor: colors.sand },
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
    borderRadius: 99,
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
    borderRadius: 16,
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
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
});
