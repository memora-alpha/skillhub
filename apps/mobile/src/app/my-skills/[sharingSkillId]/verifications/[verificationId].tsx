import { useLocalSearchParams } from "expo-router";
import { VerificationDetailScreen } from "@/features/skills";
export default function VerificationRoute() {
  const { sharingSkillId, verificationId } = useLocalSearchParams<{
    sharingSkillId?: string | string[];
    verificationId?: string | string[];
  }>();
  return (
    <VerificationDetailScreen
      sharingSkillId={sharingSkillId}
      verificationId={verificationId}
    />
  );
}
