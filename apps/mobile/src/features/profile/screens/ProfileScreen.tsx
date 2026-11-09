import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuthSession } from "@/features/auth";
import { OwnProfileSkillList } from "@/features/skills";
import { ProfileLayout } from "../components/ProfileLayout";
import { AvatarUploadNotice } from "../components/AvatarUploadNotice";
import { ProfileAbout, ProfileSummary } from "../components/ProfileSummary";
import { useProfilePreview } from "../context/ProfilePreview";
import { ProfileShortcuts } from "../components/ProfileShortcuts";
import { ProfileLogout } from "../components/ProfileLogout";
import { ProfileReviews } from "../components/profile-reviews";
import { ProfileModerationNotice } from "../components/ProfileModerationNotice";

export function ProfileScreen() {
  const { session } = useAuthSession();
  const { profile } = useProfilePreview();
  const router = useRouter();
  if (!session || !profile) return <Redirect href="/login" />;
  return (
    <ProfileLayout session={session}>
      {(open) => (
        <View style={styles.stack}>
          <ProfileSummary
            profile={profile}
            onEdit={() => router.push("/edit-profile")}
            onSettings={() => router.push("/account-settings")}
            avatarNotice={<AvatarUploadNotice />}
            linkToPublicProfile
          />
          <ProfileModerationNotice
            onEdit={() => router.push("/edit-profile")}
          />
          <ProfileShortcuts onOpen={open} />
          <ProfileAbout bio={profile.bio} />
          <ProfileReviews userId={profile.userId} own />
          <OwnProfileSkillList />
          <ProfileLogout />
        </View>
      )}
    </ProfileLayout>
  );
}
const styles = StyleSheet.create({
  stack: {
    gap: 12,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
});
