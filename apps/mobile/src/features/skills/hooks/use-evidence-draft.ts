import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useToast } from "@/providers/ToastProvider";
import { useSkills } from "../context/SkillsProvider";
import { needsScan, type EvidenceDraft } from "../utils/evidence-draft";
import { skillError } from "../utils/skill-errors";
import { prepareEvidence } from "../utils/prepare-evidence";
import {
  markEvidenceChecking,
  reconcileEvidencePolling,
} from "../utils/evidence-polling";

export function useEvidenceDraft(id: string, initial: EvidenceDraft[] = []) {
  const { api, isCurrent, verificationDrafts } = useSkills();
  const { showToast } = useToast();
  const [files, setFiles] = useState<EvidenceDraft[]>(initial);
  const [focused, setFocused] = useState(false);
  const active = useRef(false);
  const mounted = useRef(false);
  const uploading = useRef(false);
  const preparation = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const attempts = useRef(new Map<string, number>());
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      attempts.current.clear();
      setFiles(markEvidenceChecking);
      setFocused(true);
      setBusy(uploading.current);
      return () => {
        active.current = false;
        preparation.current?.abort();
        setFocused(false);
      };
    }, []),
  );
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state !== "active") preparation.current?.abort();
      if (state === "active") {
        attempts.current.clear();
        setFiles(markEvidenceChecking);
      }
    });
    return () => {
      mounted.current = false;
      preparation.current?.abort();
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!id || busy || !focused || !foreground || !isCurrent()) return;
    const waiting = files.filter(
      (file) =>
        file.fileId &&
        (file.checking || needsScan(file.state)) &&
        !file.error &&
        (attempts.current.get(file.fileId) ?? 0) < 10,
    );
    if (!waiting.length) return;
    const abort = new AbortController();
    const delay = Math.min(
      1000 *
        2 **
          Math.max(
            ...waiting.map((file) => attempts.current.get(file.fileId!) ?? 0),
          ),
      8000,
    );
    const poll = async () => {
      const results = await Promise.allSettled(
        waiting.map((file) => {
          attempts.current.set(
            file.fileId!,
            (attempts.current.get(file.fileId!) ?? 0) + 1,
          );
          return api.fileStatus(id, file.fileId!, abort.signal);
        }),
      );
      if (abort.signal.aborted || !active.current || !isCurrent()) return;
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected")
        showToast(skillError(failed.reason), "error");
      setFiles((current) =>
        reconcileEvidencePolling(current, waiting, results, attempts.current),
      );
    };
    const timer = setTimeout(() => void poll(), delay);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [files, focused, foreground, busy, api, id, isCurrent, showToast]);
  async function prepare(targetId = id) {
    if (!targetId || uploading.current || !active.current || !isCurrent())
      throw new Error("Chưa thể gửi bằng chứng. Hãy thử lại.");
    uploading.current = true;
    setBusy(true);
    const abort = new AbortController();
    preparation.current = abort;
    try {
      return await prepareEvidence({
        api,
        id: targetId,
        files,
        signal: abort.signal,
        assertCurrent: () => {
          if (!active.current || !mounted.current || !isCurrent())
            throw new Error("Quá trình gửi đã tạm dừng.");
        },
        update: (file) => {
          if (mounted.current && isCurrent()) {
            setFiles((current) =>
              current.map((item) =>
                item.localId === file.localId ? file : item,
              ),
            );
            const saved = verificationDrafts.get(targetId);
            if (saved)
              verificationDrafts.set(targetId, {
                ...saved,
                files: saved.files.map((item) =>
                  item.localId === file.localId ? file : item,
                ),
              });
          }
        },
      });
    } finally {
      preparation.current = null;
      uploading.current = false;
      if (mounted.current && isCurrent()) setBusy(false);
    }
  }
  return {
    files,
    setFiles,
    busy,
    locked: () => uploading.current,
    prepare,
  };
}
