import { Text } from "react-native";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useAuthSession } from "@/features/auth";
import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { SkillCard } from "../components/SkillCard";
import { QueryFeedback } from "../components/QueryFeedback";
import { validId } from "../hooks/use-skill-queries";
import { usePublicSkill } from "../hooks/use-public-skill";

export function PublicSkillDetailScreen({
  userId,
  sharingSkillId,
}: Readonly<{
  userId?: string | string[];
  sharingSkillId?: string | string[];
}>) {
  const router = useRouter();
  const { session } = useAuthSession();
  const profileId = validId(userId);
  const id = validId(sharingSkillId);
  const query = usePublicSkill(profileId, id);
  let content: ReactNode;
  if (!profileId || !id || query.data === null)
    content = (
      <FormNotice tone="info">
        Kỹ năng không hiển thị công khai hoặc không còn khả dụng.
      </FormNotice>
    );
  else if (!query.data) content = <QueryFeedback query={query} />;
  else
    content = (
      <>
        {!!query.error && <QueryFeedback query={query} />}
        <Text style={skillStyles.caption}>Thông tin kỹ năng công khai</Text>
        <SkillCard skill={query.data} detail />
        {profileId !== session?.userId && (
          <Button
            variant="craft"
            onPress={() => {
              if (!query.canRead()) return;
              router.push({
                pathname: "/send-proposal",
                params: {
                  userId: profileId!,
                  sharingSkillId: id!,
                },
              });
            }}
          >
            Gửi lời mời trao đổi
          </Button>
        )}
      </>
    );
  return (
    <SkillsLayout
      title="Chi tiết kỹ năng"
      fallback={
        profileId
          ? {
              pathname: "/profiles/[userId]",
              params: { userId: profileId },
            }
          : "/profile"
      }
    >
      {content}
    </SkillsLayout>
  );
}
