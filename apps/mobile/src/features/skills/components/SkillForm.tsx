import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { appRadius } from "@/constants/theme";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import { SkillsLayout } from "../components/SkillsLayout";
import { SkillEditorFields } from "./SkillEditorFields";
import {
  VerificationForm,
  type VerificationFormHandle,
} from "./VerificationForm";
import { SkillAction } from "./SkillAction";
import { SkillConflict } from "./SkillConflict";
import { useSkillSave } from "../hooks/use-skill-save";
import { usePendingBack } from "../hooks/use-pending-back";
import { useMountedSession } from "../hooks/use-mounted-session";
import { useOwnSkill } from "../hooks/use-skill-queries";
import { skillError } from "../utils/skill-errors";
import { hasPendingVerification } from "../utils/verification-state";
import {
  formValues,
  skillFormSchema,
  skillInput,
  skillPatch,
  type SkillFormValues,
} from "../schemas/skill-form";
import type { OwnSkill, CatalogSkill } from "../types/skills";
import { useSkillLevelForm } from "../hooks/use-skill-levels";

export function SkillForm({ initial }: Readonly<{ initial?: OwnSkill }>) {
  const { showToast } = useToast();
  const mountedSession = useMountedSession();
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const saveWithEvidence = useRef(!initial).current;
  const evidenceRef = useRef<VerificationFormHandle>(null);
  const {
    action,
    save: saveConfirmed,
    created,
  } = useSkillSave(baseline, setBaseline, evidenceRef, saveWithEvidence);
  const query = useOwnSkill(baseline?.id ?? null);
  const serverSnapshot = query.data;
  useEffect(() => {
    // A verification changes version/status, not the editable fields. Sync only
    // that case; conflicting content still requires explicit draft comparison.
    if (
      baseline &&
      serverSnapshot &&
      serverSnapshot.version > baseline.version &&
      serverSnapshot.archivedAt === baseline.archivedAt &&
      Object.keys(
        skillPatch(baseline, {
          ...serverSnapshot,
          skillId: serverSnapshot.skill.id,
          levelId: serverSnapshot.levelId ?? "",
        }),
      ).length === 1
    )
      setBaseline(serverSnapshot);
  }, [baseline, serverSnapshot]);
  const [selected, setSelected] = useState<CatalogSkill | undefined>(
    initial?.skill,
  );
  const [latest, setLatest] = useState<OwnSkill | null>(null);
  const [checking, setChecking] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceProgress, setEvidenceProgress] = useState<string | null>(null);
  const [evidenceState, setEvidenceState] = useState({
    hasFiles: false,
    valid: true,
  });
  const form = useForm<SkillFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(skillFormSchema),
    defaultValues: formValues(initial),
  });
  const values = form.watch();
  const { levels, levelValid } = useSkillLevelForm(form, baseline);
  const parsed = skillFormSchema.safeParse(values);
  const changed =
    parsed.success &&
    (!baseline ||
      Object.keys(skillPatch(baseline, skillInput(values))).length > 1);
  const skillPending =
    action.pending || form.formState.isSubmitting || checking;
  const pending = skillPending || evidenceBusy;
  const locked = () =>
    action.locked() || pending || !!evidenceRef.current?.locked();
  usePendingBack(locked);
  const save = form.handleSubmit(async (values) => {
    if (
      locked() ||
      !levelValid ||
      (!changed && !created) ||
      (saveWithEvidence && !evidenceState.valid)
    )
      return;
    await saveConfirmed(values);
  });
  const checkLatest = async () => {
    if (!baseline || locked()) return;
    setChecking(true);
    try {
      const result = await query.refetch({ throwOnError: true });
      if (action.current() && result.data !== undefined) {
        setLatest(result.data);
        if (!result.data) showToast("Kỹ năng không còn khả dụng.", "info");
      }
    } catch (error) {
      if (action.current()) showToast(skillError(error), "error");
    } finally {
      if (mountedSession()) setChecking(false);
    }
  };
  return (
    <SkillsLayout
      title={baseline ? "Chỉnh sửa kỹ năng" : "Thêm kỹ năng"}
      locked={locked}
    >
      <SkillEditorFields
        baseline={baseline}
        selected={selected}
        form={form}
        disabled={pending}
        levels={levels}
        onSelect={(skill) => {
          if (values.skillId !== skill.id)
            form.setValue("levelId", "", {
              shouldValidate: true,
              shouldDirty: true,
            });
          setSelected(skill);
          form.setValue("skillId", skill.id, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }}
      />
      <VerificationForm
        ref={evidenceRef}
        embedded
        id={baseline?.id}
        name={baseline?.skill.name ?? selected?.name}
        blocked={!!baseline && hasPendingVerification(baseline)}
        disabled={skillPending}
        onBusyChange={setEvidenceBusy}
        onProgressChange={setEvidenceProgress}
        saveWithSkill={saveWithEvidence}
        onDraftChange={setEvidenceState}
      />
      {baseline && !!action.error && (
        <SkillAction
          disabled={pending}
          label="Tải dữ liệu mới"
          onPress={() => void checkLatest()}
        />
      )}
      {!baseline && !!action.error && (
        <Button
          disabled={pending}
          variant="secondary"
          onPress={() => router.push("/my-skills")}
        >
          Kiểm tra danh sách kỹ năng đã lưu
        </Button>
      )}
      {latest && (
        <SkillConflict
          latest={latest}
          pending={pending}
          onAccept={() => {
            setBaseline(latest);
            setLatest(null);
            action.clearError();
          }}
        />
      )}
      <Button
        variant="craft"
        style={{ borderRadius: appRadius.button, minHeight: 48 }}
        disabled={
          pending ||
          !levelValid ||
          !form.formState.isValid ||
          (!changed && !created) ||
          (saveWithEvidence && !evidenceState.valid) ||
          !!baseline?.archivedAt ||
          !!latest
        }
        onPress={() => void save()}
      >
        {pending ? (evidenceProgress ?? "Đang lưu kỹ năng…") : "Lưu kỹ năng"}
      </Button>
      <Button
        disabled={pending}
        variant="ghost"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/my-skills")
        }
      >
        Hủy
      </Button>
    </SkillsLayout>
  );
}
