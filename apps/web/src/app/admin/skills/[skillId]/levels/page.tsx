import { SkillLevelsScreen } from "@/components/staff/levels";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ skillId: string }> }>) {
  const { skillId } = await params;
  return <SkillLevelsScreen skillId={skillId} />;
}
