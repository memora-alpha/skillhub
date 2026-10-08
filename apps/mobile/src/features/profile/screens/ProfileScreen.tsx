import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { iconSizes } from "@/constants/theme";
import { useAuthSession } from "@/features/auth";
import { ProfileLayout } from "../components/ProfileLayout";
import {
  ProfileAbout,
  ProfileSkills,
  ProfileSummary,
} from "../components/ProfileSummary";
import {
  ProfileSection,
  ProfileHeading,
  profileStyles,
} from "../components/ProfilePrimitives";
import { profileActions, profileDetails } from "../mocks/profile";
import {
  profileActionTints,
  profileColors,
  profileShadows,
} from "../constants/theme";
import { useProfilePreview } from "../context/ProfilePreview";

export function ProfileScreen() {
  const { session } = useAuthSession();
  const { profile } = useProfilePreview();
  const router = useRouter();
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  if (!session || !profile) return <Redirect href="/login" />;
  return (
    <ProfileLayout session={session}>
      {(open) => (
        <View style={styles.stack}>
          <ProfileSummary
            profile={profile}
            onEdit={() => router.push("/edit-profile")}
          />
          <Button
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/profiles/[userId]",
                params: { userId: profile.userId },
              })
            }
          >
            Xem hồ sơ công khai
          </Button>
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
                        profileActionTints[action.icon] ??
                        profileColors.neutral,
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
          <ProfileAbout bio={profile.bio} />
          <ProfileSkills
            profile={profile}
            available={false}
            onManage={() => open("Kỹ năng")}
          />
          <ProfileSection>
            <ProfileHeading
              title="Huy hiệu mẫu"
              action="Tất cả"
              onPress={() => open("Thành tích")}
            />
            <Text style={profileStyles.caption}>
              Minh họa thiết kế, chưa phải thành tích tài khoản.
            </Text>
            {!session.isNew && (
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
              </View>
            )}
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
                Email của bạn · không hiển thị công khai
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
  actionRaised: { boxShadow: profileShadows.actionRaised },
  actionIcon: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
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
