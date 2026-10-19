import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { z } from "zod";
import { EmptyState } from "@/components/EmptyState";
import { useAuthSession } from "@/features/auth";
import { PublicSelfSkillList } from "@/features/skills";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileAbout, ProfileSummary } from "../components/ProfileSummary";
import { profileStyles } from "../components/ProfilePrimitives";
import { useProfilePreview } from "../context/ProfilePreview";
import { readProfileId } from "../utils/public-profile";
import { PublicApiProfileScreen } from "./public-api-profile-screen";

export function PublicProfilePreviewScreen({
  userId,
}: {
  userId?: string | string[];
}) {
  const { session, runtime } = useAuthSession();
  const { profile } = useProfilePreview();
  const router = useRouter();
  const targetId = readProfileId(userId);
  if (!session) return <Redirect href="/login" />;
  if (
    targetId &&
    targetId !== profile?.userId &&
    z.uuid().safeParse(targetId).success
  )
    return (
      <PublicApiProfileScreen
        key={runtime.controller.generation + ":" + targetId}
        userId={targetId}
      />
    );
  const own = !!profile && targetId === profile.userId;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/profile");
  return (
    <ProfileLayout session={session} title="Hồ sơ công khai" onBack={back}>
      {() => (
        <View style={styles.stack}>
          {own ? (
            <>
              <Text style={profileStyles.caption}>
                Xem trước hồ sơ công khai
              </Text>
              <ProfileSummary profile={profile} />
              <ProfileAbout bio={profile.bio} />
              <PublicSelfSkillList />
            </>
          ) : (
            <EmptyState
              title="Hồ sơ không khả dụng"
              description="Không tìm thấy hồ sơ có thể hiển thị."
              action="Quay lại"
              onAction={back}
            />
          )}
        </View>
      )}
    </ProfileLayout>
  );
}
const styles = StyleSheet.create({
  stack: { gap: 12, width: "100%", maxWidth: 640, alignSelf: "center" },
});
