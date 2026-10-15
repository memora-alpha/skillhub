import type { createSkillsApi } from "../api/skills-api";
import {
  evidenceFormData,
  readyFileIds,
  type EvidenceDraft,
} from "./evidence-draft";
import { skillError } from "./skill-errors";
import { EvidenceScanPending, scanEvidence } from "./evidence-scan";

type EvidenceApi = Pick<
  ReturnType<typeof createSkillsApi>,
  "upload" | "fileStatus"
>;
const paused = () =>
  new Error("Quá trình gửi đã tạm dừng. Hãy bấm gửi lại để tiếp tục.");
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(paused());
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(paused());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

type PreparationOptions = {
  api: EvidenceApi;
  id: string;
  files: EvidenceDraft[];
  signal: AbortSignal;
  assertCurrent: () => void;
  update: (file: EvidenceDraft) => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  prepare?: (file: EvidenceDraft) => Promise<EvidenceDraft>;
  onSlowScan?: () => void;
};
type PreparationContext = Omit<
  PreparationOptions,
  "files" | "assertCurrent" | "sleep"
> & {
  check: () => void;
  sleep: NonNullable<PreparationOptions["sleep"]>;
};

async function uploadMissingFile(
  context: PreparationContext,
  original: EvidenceDraft,
) {
  const { api, id, update } = context;
  const file = { ...original, error: undefined };
  if (file.fileId) return file;
  update({ ...file, state: "UPLOADING", checking: false });
  try {
    const result = await api.upload(id, evidenceFormData(file));
    const uploaded = {
      ...file,
      fileId: result.fileId,
      state: result.state,
      checking: false,
    };
    update(uploaded);
    return uploaded;
  } catch (error) {
    update({
      ...file,
      state: "UPLOAD_FAILED",
      checking: false,
      error: skillError(error),
    });
    throw error;
  }
}

// Two workers pipeline preparation/upload. Drain in-flight work on failure so
// successful upload IDs are retained before an explicit retry can start.
export async function prepareEvidence({
  api,
  id,
  files,
  signal,
  assertCurrent,
  update,
  sleep = wait,
  prepare = async (file) => file,
  onSlowScan,
}: PreparationOptions) {
  if (!files.length || files.length > 5)
    throw new Error("Chọn từ 1 đến 5 file bằng chứng.");
  const context: PreparationContext = {
    api,
    id,
    signal,
    update,
    sleep,
    check: () => {
      if (signal.aborted) throw paused();
      assertCurrent();
    },
  };
  const uploaded: EvidenceDraft[] = new Array(files.length);
  let next = 0;
  let uploadFailure: { error: unknown } | undefined;
  async function worker() {
    while (!uploadFailure && next < files.length) {
      const index = next++;
      try {
        context.check();
        const original = files[index]!;
        if (!original.fileId) update({ ...original, state: "PREPARING" });
        const file = await prepare(original);
        context.check();
        update(file);
        uploaded[index] = await uploadMissingFile(context, file);
        context.check();
      } catch (error) {
        uploadFailure ??= { error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, files.length) }, worker));
  if (uploadFailure) throw uploadFailure.error;
  const scanAbort = new AbortController();
  const stopScans = () => scanAbort.abort();
  signal.addEventListener("abort", stopScans, { once: true });
  const scanContext = {
    ...context,
    signal: scanAbort.signal,
    check: () => {
      context.check();
      if (scanAbort.signal.aborted) throw paused();
    },
  };
  let failure: { error: unknown } | undefined;
  const results = await Promise.allSettled(
    uploaded.map((file) =>
      scanEvidence(
        {
          ...scanContext,
          read: (fileId, scanSignal) => api.fileStatus(id, fileId, scanSignal),
          onSlowScan,
        },
        file,
      ).catch((error: unknown) => {
        if (!failure || failure.error instanceof EvidenceScanPending)
          failure = { error };
        if (!(error instanceof EvidenceScanPending)) stopScans();
        throw error;
      }),
    ),
  );
  signal.removeEventListener("abort", stopScans);
  context.check();
  if (failure) throw failure.error;
  const prepared = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const fileIds = readyFileIds(prepared);
  if (!fileIds) throw new Error("Các file chưa sẵn sàng để gửi.");
  return fileIds;
}
