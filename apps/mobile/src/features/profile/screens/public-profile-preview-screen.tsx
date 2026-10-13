import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { useAuthSession } from "@/features/auth";
import { PublicSelfSkillList } from "@/features/skills";
import { ProfileLayout } from "../components/ProfileLayout";
import {
  ProfileAbout,
  ProfileSkills,
  ProfileSummary,
} from "../components/ProfileSummary";
import { profileColors } from "../constants/theme";
import { profileStyles } from "../components/ProfilePrimitives";
import { useProfilePreview } from "../context/ProfilePreview";
import { resolvePublicProfile } from "../mocks/public-profiles";
import { readProfileId } from "../utils/public-profile";

export function PublicProfilePreviewScreen({
  userId,
}: {
  userId?: string | string[];
}) {
  const { session, runtime } = useAuthSession();
  const { profile } = useProfilePreview();
  const targetId = readProfileId(userId);
  if (!session || !profile) return <Redirect href="/login" />;
  return (
    <PublicProfileContent
      key={runtime.controller.generation + ":" + targetId}
      userId={targetId}
    />
  );
}

function PublicProfileContent({ userId }: { userId: string | null }) {
  const router = useRouter();
  const { session } = useAuthSession();
  const { profile } = useProfilePreview();
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 200);
    return () => clearTimeout(timer);
  }, [retry]);
  if (!session || !profile) return <Redirect href="/login" />;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/profile");
  const result = resolvePublicProfile(userId, profile, retry);
  return (
    <ProfileLayout session={session} title="Hồ sơ công khai" onBack={back}>
      {() => (
        <View style={styles.stack}>
          <Text style={profileStyles.caption}>
            {userId === profile.userId
              ? "Xem trước hồ sơ công khai"
              : "Hồ sơ công khai · dữ liệu mẫu"}
          </Text>
          {!loaded ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator
                color={profileColors.accent}
                accessibilityLabel="Đang mở hồ sơ"
              />
              <Text style={profileStyles.caption}>Đang mở hồ sơ…</Text>
            </View>
          ) : result.status === "ready" ? (
            <>
              <ProfileSummary profile={result.profile} />
              <ProfileAbout bio={result.profile.bio} />
              {userId === profile.userId ? (
                <PublicSelfSkillList />
              ) : (
                <ProfileSkills
                  profile={result.profile}
                  available={userId !== profile.userId}
                />
              )}
            </>
          ) : result.status === "error" ? (
            <EmptyState
              title="Chưa thể mở hồ sơ"
              description="Có lỗi khi đọc dữ liệu demo. Bạn có thể thử lại."
              action="Thử lại"
              onAction={() => {
                setLoaded(false);
                setRetry((current) => current + 1);
              }}
            />
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
  loading: { alignItems: "center", padding: 32, gap: 12 },
});
