import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useToast } from "@/providers/ToastProvider";
import { AppError } from "@/lib/http/errors";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { useEvidenceDraft } from "./use-evidence-draft";
import { useSkillAction } from "./use-skill-action";
import { usePendingBack } from "./use-pending-back";
import { useMountedSession } from "./use-mounted-session";
import { useSkills } from "../context/SkillsProvider";
import { evidenceDraft } from "../utils/evidence-draft";
import { pickEvidence, type EvidenceSource } from "../utils/pick-evidence";
import { normalizeText } from "../schemas/skill-form";
import { skillError } from "../utils/skill-errors";

export function useVerificationForm(
  id: string | undefined,
  blocked: boolean,
  disabled: boolean,
) {
  const { api, verificationDrafts, isCurrent, rememberVerification, refresh } =
    useSkills();
  const initial = useRef(id ? verificationDrafts.get(id) : undefined).current;
  const draft = useEvidenceDraft(id ?? "", initial?.files);
  const action = useSkillAction({ notifySuccess: false });
  const mountedSession = useMountedSession();
  const router = useRouter();
  const { showToast } = useToast();
  const sending = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const selecting = useRef(false);
  const [picking, setPicking] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const snapshot = useRef({ files: draft.files, title, description });
  snapshot.current = { files: draft.files, title, description };
  const preserveDraft = useCallback(
    (savedId: string) => {
      if (!isCurrent()) return;
      if (snapshot.current.files.length)
        verificationDrafts.set(savedId, snapshot.current);
      else verificationDrafts.delete(savedId);
    },
    [isCurrent, verificationDrafts],
  );
  useFocusEffect(
    useCallback(
      () => () => {
        if (id) preserveDraft(id);
      },
      [id, preserveDraft],
    ),
  );
  const localBusy = preparing || action.pending || draft.busy || picking;
  const busy = localBusy || disabled;
  const localLocked = () =>
    sending.current || action.locked() || draft.locked() || selecting.current;
  const locked = () => disabled || localLocked();
  usePendingBack(locked);
  const titleInvalid = [...normalizeText(title)].length > 120;
  const descriptionInvalid = [...normalizeText(description)].length > 500;
  const pick = async (source: EvidenceSource) => {
    if (locked() || blocked || submittedId || draft.files.length >= 5) return;
    selecting.current = true;
    setPicking(true);
    try {
      const assets = await pickEvidence(source, 5 - draft.files.length);
      if (!assets.length || !action.current()) return;
      if (draft.files.length + assets.length > 5)
        throw new Error("Một lần gửi chỉ gồm tối đa 5 file.");
      const additions = assets.map((asset) => {
        if (Platform.OS === "web" && !asset.file)
          throw new Error("Không đọc được file đã chọn. Hãy chọn lại.");
        return evidenceDraft(asset, randomUUID());
      });
      draft.setFiles((current) => [...current, ...additions]);
    } catch (error) {
      if (action.current())
        showToast(
          error instanceof Error
            ? error.message
            : source === "photos"
              ? "Không mở được thư viện ảnh."
              : "Không mở được trình chọn file.",
          "error",
        );
    } finally {
      selecting.current = false;
      if (mountedSession()) setPicking(false);
    }
  };
  const submit = async () => {
    if (
      !id ||
      locked() ||
      !draft.files.length ||
      titleInvalid ||
      descriptionInvalid ||
      submittedId ||
      blocked
    )
      return;
    sending.current = true;
    setPreparing(true);
    action.clearError();
    try {
      const fileIds = await draft.prepare();
      if (!action.current()) return;
      const body = {
        fileIds,
        title: normalizeText(title),
        description: normalizeText(description),
      };
      await action.run(
        `submit:${id}`,
        body,
        async (key) => {
          try {
            const result = await api.submit(id, body, key);
            if (action.current()) await rememberVerification(result);
            return result;
          } catch (error) {
            if (
              error instanceof AppError &&
              error.code === "VERIFICATION_PENDING" &&
              action.current()
            )
              await refresh();
            throw error;
          }
        },
        (result, refreshed) => {
          setSubmittedId(result.id);
          verificationDrafts.delete(id);
          snapshot.current = { files: [], title: "", description: "" };
          draft.setFiles([]);
          showToast(
            refreshed
              ? "Đã gửi yêu cầu xác minh."
              : "Đã gửi yêu cầu. Chưa cập nhật được dữ liệu; hãy làm mới.",
            refreshed ? "success" : "info",
          );
          router.dismissTo({
            pathname: "/my-skills/[sharingSkillId]",
            params: { sharingSkillId: id },
          });
        },
      );
    } catch (error) {
      if (action.current())
        showToast(
          error instanceof Error && !("kind" in error)
            ? error.message
            : skillError(error),
          "error",
        );
    } finally {
      sending.current = false;
      if (mountedSession()) setPreparing(false);
    }
  };
  return {
    draft,
    action,
    title,
    setTitle,
    description,
    setDescription,
    picking,
    submittedId,
    busy,
    localBusy,
    locked,
    localLocked,
    preparing,
    titleInvalid,
    descriptionInvalid,
    pick,
    submit,
    preserveDraft,
  };
}
