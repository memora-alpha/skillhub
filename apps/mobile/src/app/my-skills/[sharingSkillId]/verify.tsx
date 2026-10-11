import { useLocalSearchParams } from "expo-router";
import { VerifySkillScreen } from "@/features/skills";
export default function VerifySkillRoute() {
  const { sharingSkillId } = useLocalSearchParams<{
    sharingSkillId?: string | string[];
  }>();
  return <VerifySkillScreen sharingSkillId={sharingSkillId} />;
}
