import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useAuthSession } from "@/features/auth";
import { ProfileLayout } from "../components/ProfileLayout";
import { AvatarUploadNotice } from "../components/AvatarUploadNotice";
import {
  ProfileAbout,
  ProfileSkills,
  ProfileSummary,
} from "../components/ProfileSummary";
import { useProfilePreview } from "../context/ProfilePreview";
import { ProfileShortcuts } from "../components/ProfileShortcuts";

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
          <Button variant="paper" onPress={() => router.push("/ui")}>
            Bộ giao diện mobile
          </Button>
          <ProfileAbout bio={profile.bio} />
          <ProfileSkills
            profile={profile}
            available={false}
            onManage={() => open("Kỹ năng")}
          />
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
