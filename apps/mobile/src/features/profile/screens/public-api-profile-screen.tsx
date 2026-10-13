import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { useAuthSession } from "@/features/auth";
import { PublicProfileSkillList } from "@/features/skills";
import { errorMessage } from "@/lib/http/errors";
import { ProfileLayout } from "../components/ProfileLayout";
import { ProfileAbout, ProfileSummary } from "../components/ProfileSummary";
import { usePublicProfile } from "../hooks/use-public-profile";
import { profileColors } from "../constants/theme";

export function PublicApiProfileScreen({ userId }: { userId: string }) {
  const { session } = useAuthSession();
  const query = usePublicProfile(userId);
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const back = () => {
    if (router.canGoBack()) return router.back();
    if (typeof requestId === "string" && z.uuid().safeParse(requestId).success)
      return router.replace({
        pathname: "/request/[id]",
        params: { id: requestId },
      });
    router.replace("/discover");
  };
  if (!session) return null;
  return (
    <ProfileLayout
      session={session}
      title="Hồ sơ công khai"
      onBack={back}
      backLabel="Quay lại"
    >
      {() => (
        <View style={styles.stack}>
          {query.data === null ? (
            <EmptyState
              title="Hồ sơ không khả dụng"
              description="Hồ sơ không còn công khai hoặc bạn không có quyền xem."
              action="Thử lại"
              onAction={() => void query.refetch()}
            />
          ) : query.data ? (
            <>
              {query.error && (
                <>
                  <FormNotice tone="error">
                    {errorMessage(query.error)}
                  </FormNotice>
                  <Button
                    variant="ghost"
                    disabled={query.isFetching}
                    onPress={() => void query.refetch()}
                  >
                    Thử tải lại
                  </Button>
                </>
              )}
              <ProfileSummary profile={query.data} />
              <ProfileAbout bio={query.data.bio} />
              <PublicProfileSkillList userId={userId} />
            </>
          ) : query.error ? (
            <EmptyState
              title="Chưa thể tải hồ sơ"
              description={errorMessage(query.error)}
              action="Thử lại"
              onAction={() => void query.refetch()}
            />
          ) : (
            <ActivityIndicator
              color={profileColors.accent}
              accessibilityLabel="Đang tải hồ sơ công khai"
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
