import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { ProfileButton as Button } from "../components/ProfileButton";
import { useAuthSession } from "@/features/auth";
import { OwnProfileSkillList } from "@/features/skills";
import { ProfileLayout } from "../components/ProfileLayout";
import { AvatarUploadNotice } from "../components/AvatarUploadNotice";
import { ProfileAbout, ProfileSummary } from "../components/ProfileSummary";
import { useProfilePreview } from "../context/ProfilePreview";
import { ProfileShortcuts } from "../components/ProfileShortcuts";
import { ProfileLogout } from "../components/ProfileLogout";
import { ProfileReviews } from "../components/profile-reviews";
import { Copy, Panel, RouteButton } from "@/components/feature-page";

export function ProfileScreen() {
  const { session, account } = useAuthSession();
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
            avatarNotice={<AvatarUploadNotice />}
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
          <ProfileShortcuts
            onOpen={open}
            onSettings={() => router.push("/account-settings")}
          />
          <ProfileAbout bio={profile.bio} />
          {(account?.profile.profileModeration?.bio ||
            account?.profile.profileModeration?.avatar) && (
            <Panel title="Hồ sơ cần cập nhật">
              {(["bio", "avatar"] as const).map((field) => {
                const note = account.profile.profileModeration?.[field];
                return note ? (
                  <Copy key={field}>
                    {field === "bio" ? "Giới thiệu" : "Ảnh đại diện"}:{" "}
                    {note.reason}
                  </Copy>
                ) : null;
              })}
              <RouteButton href="/edit-profile">Cập nhật hồ sơ</RouteButton>
            </Panel>
          )}
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
