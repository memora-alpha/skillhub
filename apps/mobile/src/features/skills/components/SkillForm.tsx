import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
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
import { useSkillAction } from "../hooks/use-skill-action";
import { usePendingBack } from "../hooks/use-pending-back";
import { useMountedSession } from "../hooks/use-mounted-session";
import { useSkills } from "../context/SkillsProvider";
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

export function SkillForm({ initial }: { initial?: OwnSkill }) {
  const { api } = useSkills();
  const { showToast } = useToast();
  const action = useSkillAction({ notifySuccess: false });
  const mountedSession = useMountedSession();
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const serverSnapshot = useOwnSkill(baseline?.id ?? null).data;
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
  const evidenceRef = useRef<VerificationFormHandle>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const form = useForm<SkillFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(skillFormSchema),
    defaultValues: formValues(initial),
  });
  const values = form.watch();
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
    if (locked() || !changed) return;
    const input = skillInput(values);
    const body = baseline ? skillPatch(baseline, input) : input;
    await action.run(
      baseline ? `update:${baseline.id}` : "create",
      body,
      (key) =>
        baseline
          ? api.update(baseline.id, skillPatch(baseline, input), key)
          : api.create(input, key),
      (saved, refreshed) => {
        evidenceRef.current?.preserveDraft(saved.id);
        showToast(
          refreshed
            ? "Đã lưu kỹ năng."
            : "Đã lưu kỹ năng. Chưa cập nhật được toàn bộ dữ liệu; hãy tải lại.",
          refreshed ? "success" : "info",
        );
        router.dismissTo("/my-skills");
      },
    );
  });
  const checkLatest = async () => {
    if (!baseline || locked()) return;
    setChecking(true);
    try {
      const result = await api.findOwn(baseline.id);
      if (action.current()) {
        setLatest(result);
        if (!result) showToast("Kỹ năng không còn khả dụng.", "info");
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
        onSelect={(skill) => {
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
        style={{ borderRadius: 12, minHeight: 48 }}
        disabled={
          pending ||
          !form.formState.isValid ||
          !changed ||
          !!baseline?.archivedAt ||
          !!latest
        }
        onPress={() => void save()}
      >
        {pending ? "Đang xử lý…" : "Lưu kỹ năng"}
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
