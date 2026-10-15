import { useCallback, useRef, useState, useEffect } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useToast } from "@/providers/ToastProvider";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { useSkillAction } from "./use-skill-action";
import { usePendingBack } from "./use-pending-back";
import { useMountedSession } from "./use-mounted-session";
import { useSkills } from "../context/SkillsProvider";
import { evidenceDraft } from "../utils/evidence-draft";
import { pickEvidence, type EvidenceSource } from "../utils/pick-evidence";
import { normalizeText } from "../schemas/skill-form";
import { useEvidenceTransfer } from "./use-evidence-transfer";

export function useVerificationForm(
  id: string | undefined,
  blocked: boolean,
  disabled: boolean,
) {
  const { verificationDrafts, isCurrent, transfers } = useSkills();
  const initial = useRef(id ? verificationDrafts.get(id) : undefined).current;
  const [files, setFiles] = useState(initial?.files ?? []);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const action = useSkillAction({ notifySuccess: false });
  const mountedSession = useMountedSession();
  const router = useRouter();
  const { showToast } = useToast();
  const selecting = useRef(false);
  const [picking, setPicking] = useState(false);
  const task = useEvidenceTransfer(id);
  const ownedByTransfer = useRef(new Set<string>());
  const snapshot = useRef({ files, title, description });
  snapshot.current = { files, title, description };
  const preserveDraft = useCallback(
    (savedId: string) => {
      const state = transfers.get(savedId)?.state;
      if (
        !isCurrent() ||
        ownedByTransfer.current.has(savedId) ||
        state === "SENDING" ||
        state === "PENDING"
      )
        return;
      if (snapshot.current.files.length)
        verificationDrafts.set(savedId, snapshot.current);
      else verificationDrafts.delete(savedId);
    },
    [isCurrent, verificationDrafts, transfers],
  );
  useEffect(() => {
    if (!id) return;
    if (task?.state === "PENDING") {
      setFiles([]);
      setTitle("");
      setDescription("");
      return;
    }
    if (!task || !["SENDING", "FAILED", "WAITING_SCAN"].includes(task.state))
      return;
    const saved = verificationDrafts.get(id);
    if (saved) {
      setFiles(saved.files);
      setTitle(saved.title);
      setDescription(saved.description);
    }
    if (task.state !== "SENDING") ownedByTransfer.current.delete(id);
  }, [id, task, verificationDrafts]);
  useFocusEffect(
    useCallback(
      () => () => {
        if (id) preserveDraft(id);
      },
      [id, preserveDraft],
    ),
  );
  const localLocked = () => selecting.current;
  const locked = () =>
    disabled ||
    selecting.current ||
    (!!id && transfers.get(id)?.state === "SENDING");
  // Sending belongs to the session and continues after leaving this screen.
  usePendingBack(() => disabled || selecting.current);
  const titleInvalid = [...normalizeText(title)].length > 120;
  const descriptionInvalid = [...normalizeText(description)].length > 500;
  const submittedId = task?.state === "PENDING" ? task.verificationId : null;
  const pick = async (source: EvidenceSource) => {
    if (locked() || blocked || submittedId || files.length >= 5) return;
    selecting.current = true;
    setPicking(true);
    try {
      const assets = await pickEvidence(source, 5 - files.length);
      if (!assets.length || !action.current()) return;
      if (files.length + assets.length > 5)
        throw new Error("Một lần gửi chỉ gồm tối đa 5 file.");
      const additions = assets.map((asset) => {
        if (Platform.OS === "web" && !asset.file)
          throw new Error("Không đọc được file đã chọn. Hãy chọn lại.");
        return evidenceDraft(asset, randomUUID());
      });
      setFiles((current) => [...current, ...additions]);
    } catch (error) {
      if (action.current())
        showToast(
          error instanceof Error
            ? error.message
            : "Không chọn được bằng chứng.",
          "error",
        );
    } finally {
      selecting.current = false;
      if (mountedSession()) setPicking(false);
    }
  };
  const queueForSkill = (targetId: string) => {
    if (
      selecting.current ||
      !action.current() ||
      !files.length ||
      titleInvalid ||
      descriptionInvalid ||
      blocked ||
      submittedId
    )
      return false;
    const queued = transfers.start(targetId, snapshot.current);
    if (queued) ownedByTransfer.current.add(targetId);
    return queued;
  };
  const submit = () => {
    if (!id || locked()) return;
    if (queueForSkill(id)) {
      showToast("Đang gửi bằng chứng…", "info");
      router.dismissTo({
        pathname: "/my-skills/[sharingSkillId]",
        params: { sharingSkillId: id },
      });
    }
  };
  return {
    draft: { files, setFiles },
    action,
    title,
    setTitle,
    description,
    setDescription,
    picking,
    submittedId,
    busy: disabled || picking || task?.state === "SENDING",
    localBusy: picking,
    locked,
    localLocked,
    preparing: task?.state === "SENDING",
    progress: task?.progress,
    waitingScan: task?.state === "WAITING_SCAN",
    titleInvalid,
    descriptionInvalid,
    pick,
    submit,
    queueForSkill,
    preserveDraft,
  };
}
