import { Text } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { SkillCard } from "../components/SkillCard";
import { QueryFeedback } from "../components/QueryFeedback";
import { validId } from "../hooks/use-skill-queries";
import { usePublicSkill } from "../hooks/use-public-skill";

export function PublicSkillDetailScreen({
  userId,
  sharingSkillId,
}: {
  userId?: string | string[];
  sharingSkillId?: string | string[];
}) {
  const profileId = validId(userId);
  const id = validId(sharingSkillId);
  const query = usePublicSkill(profileId, id);
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
      {!profileId || !id || query.data === null ? (
        <FormNotice tone="info">
          Kỹ năng không hiển thị công khai hoặc không còn khả dụng.
        </FormNotice>
      ) : query.error || !query.data ? (
        <QueryFeedback query={query} />
      ) : (
        <>
          <Text style={skillStyles.caption}>Thông tin kỹ năng công khai</Text>
          <SkillCard skill={query.data} detail />
        </>
      )}
    </SkillsLayout>
  );
}
