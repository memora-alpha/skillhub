import { FormNotice } from "@/components/FormNotice";
import { SkillForm } from "../components/SkillForm";
import { SkillsLayout } from "../components/SkillsLayout";
import { QueryFeedback } from "../components/QueryFeedback";
import { useOwnSkill, validId } from "../hooks/use-skill-queries";
import { useSkills } from "../context/SkillsProvider";
export function SkillFormScreen({
  sharingSkillId,
  creating = false,
}: {
  sharingSkillId?: string | string[];
  creating?: boolean;
}) {
  const id = validId(sharingSkillId);
  const query = useOwnSkill(creating ? null : id);
  const { generation } = useSkills();
  if (creating) return <SkillForm key={generation} />;
  if (!id || query.data === null || query.data?.archivedAt)
    return (
      <SkillsLayout title="Chỉnh sửa kỹ năng">
        <FormNotice tone="info">Kỹ năng không khả dụng.</FormNotice>
      </SkillsLayout>
    );
  if (!query.data)
    return (
      <SkillsLayout title="Chỉnh sửa kỹ năng">
        <QueryFeedback query={query} />
      </SkillsLayout>
    );
  return <SkillForm key={`${generation}:${id}`} initial={query.data} />;
}
