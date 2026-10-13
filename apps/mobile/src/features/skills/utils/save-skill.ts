import type { createSkillsApi } from "../api/skills-api";
import type { OwnSkill, SkillInput } from "../types/skills";
import { skillPatch } from "../schemas/skill-form";

type Evidence = {
  hasFiles: () => boolean;
  valid: () => boolean;
  preserveDraft: (id: string) => void;
  submitForSkill: (id: string) => Promise<unknown>;
};

export type SkillSaveResult = {
  skill: OwnSkill;
  evidenceSent: boolean;
  evidenceFailure?: { error: unknown };
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
  if (send) {
    evidence!.preserveDraft(skill.id);
    try {
      await evidence!.submitForSkill(skill.id);
    } catch (error) {
      assertCurrent();
      return { skill, evidenceSent: false, evidenceFailure: { error } };
    }
    assertCurrent();
  }
  return { skill, evidenceSent: send };
}
