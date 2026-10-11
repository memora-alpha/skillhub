import { FormNotice } from "@/components/FormNotice";
import { SkillsLayout } from "../components/SkillsLayout";
import { QueryFeedback } from "../components/QueryFeedback";
import { VerificationForm } from "../components/VerificationForm";
import { useOwnSkill, validId } from "../hooks/use-skill-queries";
import { useSkills } from "../context/SkillsProvider";
import { hasPendingVerification } from "../utils/verification-state";
export function VerifySkillScreen({
  sharingSkillId,
}: {
  sharingSkillId?: string | string[];
}) {
  const id = validId(sharingSkillId);
  const query = useOwnSkill(id);
  const { generation } = useSkills();
  if (!id || query.data === null || query.data?.archivedAt)
    return (
      <SkillsLayout title="Xác minh kỹ năng">
        <FormNotice tone="info">Kỹ năng không khả dụng.</FormNotice>
      </SkillsLayout>
    );
  if (!query.data)
    return (
      <SkillsLayout title="Xác minh kỹ năng">
        <QueryFeedback query={query} />
      </SkillsLayout>
    );
  return (
    <VerificationForm
      key={`${generation}:${id}`}
      id={id}
      name={query.data.skill.name}
      blocked={hasPendingVerification(query.data)}
    />
  );
}
