import { useRef, useState, type RefObject } from "react";
import { useRouter } from "expo-router";
import { AppError } from "@/lib/http/errors";
import { useToast } from "@/providers/ToastProvider";
import { useSkills } from "../context/SkillsProvider";
import { useSkillAction } from "./use-skill-action";
import { saveSkill } from "../utils/save-skill";
import {
  skillInput,
  skillPatch,
  type SkillFormValues,
} from "../schemas/skill-form";
import type { OwnSkill } from "../types/skills";
import type { VerificationFormHandle } from "../components/VerificationForm";

export function useSkillSave(
  baseline: OwnSkill | undefined,
  setBaseline: (skill: OwnSkill) => void,
  evidenceRef: RefObject<VerificationFormHandle | null>,
  saveWithEvidence: boolean,
) {
  const { api, rememberSkill } = useSkills();
  const { showToast } = useToast();
  const router = useRouter();
  const action = useSkillAction({ notifySuccess: false });
  const saved = useRef<OwnSkill | undefined>(undefined);
  const [created, setCreated] = useState(false);
  const save = async (values: SkillFormValues) => {
    const previous = baseline ?? saved.current;
    const input = skillInput(values);
    await action.run(
      previous ? `update:${previous.id}` : "create",
      previous ? skillPatch(previous, input) : input,
      (key) =>
        saveSkill({
          api,
          previous,
          input,
          key,
          evidence: saveWithEvidence ? evidenceRef.current : undefined,
          assertCurrent: () => {
            if (!action.current()) throw new AppError("session");
          },
          onSaved: async (skill, isCreated) => {
            saved.current = skill;
            if (isCreated) {
              setCreated(true);
              setBaseline(skill);
            }
            await rememberSkill(skill, isCreated);
          },
        }),
      ({ skill, evidenceQueued }, refreshed) => {
        if (!evidenceQueued) evidenceRef.current?.preserveDraft(skill.id);
        const message = evidenceQueued
          ? "Đã lưu kỹ năng. Đang gửi bằng chứng…"
          : "Đã lưu kỹ năng.";
        showToast(
          refreshed !== false
            ? message
            : `${message} Chưa cập nhật được toàn bộ dữ liệu; hãy tải lại.`,
          refreshed !== false ? "success" : "info",
        );
        router.dismissTo("/my-skills");
      },
      "background",
    );
  };
  return { action, save, created };
}
