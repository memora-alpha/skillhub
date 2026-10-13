import { useLocalSearchParams } from "expo-router";
import { PublicSkillDetailScreen } from "@/features/skills";

export default function PublicSkillRoute() {
  const { userId, sharingSkillId } = useLocalSearchParams<{
    userId?: string | string[];
    sharingSkillId?: string | string[];
  }>();
  return (
    <PublicSkillDetailScreen userId={userId} sharingSkillId={sharingSkillId} />
  );
}
