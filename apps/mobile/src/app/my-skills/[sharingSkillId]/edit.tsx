import { useLocalSearchParams } from "expo-router";
import { SkillFormScreen } from "@/features/skills";
export default function EditSkillRoute() {
  const { sharingSkillId } = useLocalSearchParams<{
    sharingSkillId?: string | string[];
  }>();
  return <SkillFormScreen sharingSkillId={sharingSkillId} />;
}
