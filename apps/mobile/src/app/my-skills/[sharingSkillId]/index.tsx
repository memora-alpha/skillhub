import { useLocalSearchParams } from "expo-router";
import { SkillDetailScreen } from "@/features/skills";
export default function SkillDetailRoute() {
  const { sharingSkillId } = useLocalSearchParams<{
    sharingSkillId?: string | string[];
  }>();
  return <SkillDetailScreen sharingSkillId={sharingSkillId} />;
}
