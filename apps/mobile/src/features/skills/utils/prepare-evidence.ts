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

// A user-initiated send uploads missing files and checks every file before submit.
// Updates persist after each upload so an explicit retry can reuse its file ID.
export async function prepareEvidence({
  api,
  id,
  files,
  signal,
  assertCurrent,
  update,
  sleep = wait,
}: {
  api: EvidenceApi;
  id: string;
  files: EvidenceDraft[];
  signal: AbortSignal;
  assertCurrent: () => void;
  update: (file: EvidenceDraft) => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}) {
  if (!files.length || files.length > 5)
    throw new Error("Chọn từ 1 đến 5 file bằng chứng.");
  const prepared: EvidenceDraft[] = [];
  const check = () => {
    if (signal.aborted) throw paused();
    assertCurrent();
  };
  for (const original of files) {
    check();
    let file = { ...original, error: undefined };
    if (!file.fileId) {
      update({ ...file, state: "UPLOADING", checking: false });
      try {
        const result = await api.upload(id, evidenceFormData(file));
        file = {
          ...file,
          fileId: result.fileId,
          state: result.state,
          checking: false,
        };
        update(file);
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
    check();
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        check();
        const result = await api.fileStatus(id, file.fileId!, signal);
        check();
        file = { ...file, state: result.state, checking: false };
        update(file);
        if (file.state === "READY") break;
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
    prepared.push(file);
  }
  check();
  const fileIds = readyFileIds(prepared);
  if (!fileIds) throw new Error("Các file chưa sẵn sàng để gửi.");
  return fileIds;
}
