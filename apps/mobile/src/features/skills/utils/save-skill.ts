import type { createSkillsApi } from "../api/skills-api";
import type { OwnSkill, SkillInput } from "../types/skills";
import { skillPatch } from "../schemas/skill-form";

type Evidence = {
  hasFiles: () => boolean;
  valid: () => boolean;
  preserveDraft: (id: string) => void;
  queueForSkill: (id: string) => boolean;
};

export type SkillSaveResult = {
  skill: OwnSkill;
  evidenceQueued: boolean;
};

export async function saveSkill({
  api,
  previous,
  input,
  key,
  evidence,
  assertCurrent,
  onSaved,
}: {
  api: Pick<ReturnType<typeof createSkillsApi>, "create" | "update">;
  previous?: OwnSkill;
  input: SkillInput;
  key: string;
  evidence?: Evidence | null;
  assertCurrent: () => void;
  onSaved: (skill: OwnSkill, created: boolean) => Promise<void>;
}): Promise<SkillSaveResult> {
  assertCurrent();
  const send = !!evidence?.hasFiles();
  if (send && !evidence!.valid())
    throw new Error("Kiểm tra tiêu đề và mô tả bằng chứng trước khi lưu.");
  const patch = previous ? skillPatch(previous, input) : null;
  let skill: OwnSkill;
  if (!previous) skill = await api.create(input, key);
  else if (Object.keys(patch!).length > 1)
    skill = await api.update(previous.id, patch!, key);
  else skill = previous;
  assertCurrent();
  // Persist the confirmed skill before file I/O; evidence failure cannot undo it.
  await onSaved(skill, !previous);
  assertCurrent();
  let evidenceQueued = false;
  if (send) {
    evidence!.preserveDraft(skill.id);
    evidenceQueued = evidence!.queueForSkill(skill.id);
  }
  return { skill, evidenceQueued };
}
