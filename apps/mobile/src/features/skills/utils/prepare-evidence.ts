import type { createSkillsApi } from "../api/skills-api";
import {
  evidenceFormData,
  needsScan,
  readyFileIds,
  type EvidenceDraft,
} from "./evidence-draft";
import { skillError } from "./skill-errors";

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

async function scanFile(context: PreparationContext, original: EvidenceDraft) {
  const { api, id, update, check, signal, sleep } = context;
  let file = original;
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      check();
      const result = await api.fileStatus(id, file.fileId!, signal);
      check();
      file = { ...file, state: result.state, checking: false };
      update(file);
      if (file.state === "READY") return file;
      if (!needsScan(file.state))
        throw new Error(
          "File chưa thể sử dụng. Hãy bỏ file này và chọn bằng chứng khác.",
        );
      if (attempt === 9)
        throw new Error(
          "File đang được kiểm tra lâu hơn dự kiến. Hãy bấm gửi lại sau.",
        );
      await sleep(Math.min(1000 * 2 ** attempt, 8000), signal);
    }
  } catch (error) {
    const failure = signal.aborted ? paused() : error;
    update({
      ...file,
      checking: false,
      error:
        failure instanceof Error && !("kind" in failure)
          ? failure.message
          : skillError(failure),
    });
    throw failure;
  }
  return file;
}

// Upload and scan sequentially; preserve each uploaded ID for an explicit retry.
export async function prepareEvidence({
  api,
  id,
  files,
  signal,
  assertCurrent,
  update,
  sleep = wait,
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
  const prepared: EvidenceDraft[] = [];
  for (const original of files) {
    context.check();
    const file = await uploadMissingFile(context, original);
    context.check();
    prepared.push(await scanFile(context, file));
  }
  context.check();
  const fileIds = readyFileIds(prepared);
  if (!fileIds) throw new Error("Các file chưa sẵn sàng để gửi.");
  return fileIds;
}
