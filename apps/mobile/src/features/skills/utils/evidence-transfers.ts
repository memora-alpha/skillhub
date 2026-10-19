import { AppError } from "@/lib/http/errors";
import type { OwnSkill } from "../types/skills";
import { normalizeText } from "../schemas/skill-form";
import { skillError } from "./skill-errors";
import { evidenceProgress } from "./evidence-progress";
import { EvidenceScanPending } from "./evidence-scan";
import {
  runEvidenceTransfer,
  type EvidenceTransferDependencies,
} from "./run-evidence-transfer";

export type EvidenceTransfer = {
  state: "SENDING" | "WAITING_SCAN" | "FAILED" | "PENDING";
  progress?: string;
  verificationId?: string;
  error?: string;
};

export function createEvidenceTransfers(
  dependencies: EvidenceTransferDependencies,
) {
  const {
    drafts,
    intents,
    isCurrent,
    notify,
    refresh,
    canRead = () => true,
  } = dependencies;
  const listeners = new Set<() => void>();
  let tasks = new Map<string, EvidenceTransfer>();
  const controllers = new Map<string, AbortController>();
  const forgotten = new Set<string>();
  let disposed = false;
  let pausedInBackground = false;
  function publish(id: string, task?: EvidenceTransfer) {
    tasks = new Map(tasks);
    if (task) tasks.set(id, task);
    else tasks.delete(id);
    for (const listener of listeners) listener();
  }
  const current = () => !disposed && isCurrent();
  const paused = () =>
    new Error("Quá trình gửi đã tạm dừng. Bấm Thử lại để tiếp tục.");
  function start(id: string, input = drafts.get(id)) {
    if (
      !current() ||
      !canRead(id) ||
      forgotten.has(id) ||
      controllers.has(id) ||
      tasks.get(id)?.state === "PENDING"
    )
      return false;
    if (
      !input?.files.length ||
      input.files.length > 5 ||
      [...normalizeText(input.title)].length > 120 ||
      [...normalizeText(input.description)].length > 500
    )
      throw new Error("Kiểm tra file, tiêu đề và mô tả bằng chứng.");
    const draft = { ...input, files: input.files.map((file) => ({ ...file })) };
    drafts.set(id, draft);
    if (pausedInBackground) {
      publish(id, { state: "FAILED", error: paused().message });
      return false;
    }
    const abort = new AbortController();
    controllers.set(id, abort);
    let slowScan = false;
    const progress = () => {
      if (!current() || controllers.get(id) !== abort) return;
      const label = evidenceProgress(
        drafts.get(id)?.files ?? draft.files,
        slowScan,
      );
      if (tasks.get(id)?.progress !== label)
        publish(id, { state: "SENDING", progress: label });
    };
    progress();
    const check = () => {
      if (!current()) throw new AppError("session");
      if (!canRead(id)) throw new AppError("http", 403);
      if (abort.signal.aborted) throw paused();
    };
    void runEvidenceTransfer(
      dependencies,
      id,
      draft,
      abort.signal,
      check,
      (file) => {
        if (!current() || controllers.get(id) !== abort) return;
        const saved = drafts.get(id);
        if (saved)
          drafts.set(id, {
            ...saved,
            files: saved.files.map((item) =>
              item.localId === file.localId ? file : item,
            ),
          });
        progress();
      },
      () => {
        slowScan = true;
        progress();
      },
    )
      .then((batch) => {
        check();
        drafts.delete(id);
        intents.delete(id);
        if (batch.status === "PENDING")
          publish(id, { state: "PENDING", verificationId: batch.id });
        else publish(id);
        notify(
          batch.status === "PENDING"
            ? "Đã gửi yêu cầu xác minh."
            : "Yêu cầu xác minh đã được xử lý.",
          "success",
        );
        void refresh().catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (!current() || !tasks.has(id)) return;
        controllers.delete(id);
        if (!abort.signal.aborted && error instanceof EvidenceScanPending) {
          publish(id, { state: "WAITING_SCAN", progress: error.message });
          notify(error.message, "info");
          return;
        }
        publish(id, {
          state: "FAILED",
          error: abort.signal.aborted ? paused().message : skillError(error),
        });
        if (!canRead(id)) return;
        if (!abort.signal.aborted)
          notify(`Gửi bằng chứng chưa hoàn tất. ${skillError(error)}`, "error");
        void refresh().catch(() => undefined);
      })
      .finally(() => {
        if (controllers.get(id) === abort) controllers.delete(id);
      });
    return true;
  }
  const observe = (
    batches: { id: string; sharingSkillId: string; status: string }[],
  ) => {
    for (const batch of batches) {
      const task = tasks.get(batch.sharingSkillId);
      if (
        task?.state === "PENDING" &&
        task.verificationId === batch.id &&
        batch.status !== "PENDING"
      )
        publish(batch.sharingSkillId);
    }
  };
  return {
    start,
    activate() {
      disposed = false;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: (id: string) => tasks.get(id) ?? null,
    observe,
    observeSkills(skills: OwnSkill[]) {
      observe(
        skills.flatMap((skill) =>
          skill.latestVerification
            ? [{ ...skill.latestVerification, sharingSkillId: skill.id }]
            : [],
        ),
      );
    },
    forget(id: string) {
      forgotten.add(id);
      controllers.get(id)?.abort();
      controllers.delete(id);
      drafts.delete(id);
      intents.delete(id);
      publish(id);
    },
    pause() {
      pausedInBackground = true;
      for (const abort of controllers.values()) abort.abort();
    },
    pauseDenied() {
      for (const [id, abort] of controllers) if (!canRead(id)) abort.abort();
    },
    resume() {
      pausedInBackground = false;
    },
    dispose() {
      disposed = true;
      for (const abort of controllers.values()) abort.abort();
      controllers.clear();
      tasks.clear();
      listeners.clear();
    },
  };
}
