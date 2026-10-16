import type { EvidenceDraft } from "./evidence-draft";
import { needsScan } from "./evidence-draft";
import { skillError } from "./skill-errors";

export class EvidenceScanPending extends Error {
  constructor() {
    super(
      "Bằng chứng đã tải lên và vẫn đang được kiểm tra. Kiểm tra lại sau, không cần tải lại file.",
    );
  }
}

export type EvidenceScanContext = {
  read: (
    fileId: string,
    signal: AbortSignal,
  ) => Promise<{ fileId: string; state: string }>;
  update: (file: EvidenceDraft) => void;
  check: () => void;
  signal: AbortSignal;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  onSlowScan?: () => void;
};

function scanError(error: unknown) {
  if (error instanceof EvidenceScanPending) return undefined;
  if (error instanceof Error && !("kind" in error)) return error.message;
  return skillError(error);
}

export async function scanEvidence(
  context: EvidenceScanContext,
  original: EvidenceDraft,
) {
  const { read, update, check, signal, sleep, onSlowScan } = context;
  let file = original;
  try {
    // Fast initial checks, then a bounded window covering slow scanner retries.
    for (let attempt = 0; attempt < 48; attempt++) {
      check();
      const result = await read(file.fileId!, signal);
      check();
      file = { ...file, state: result.state, checking: false };
      update(file);
      if (file.state === "READY") return file;
      if (!needsScan(file.state))
        throw new Error(
          "File chưa thể sử dụng. Hãy bỏ file này và chọn bằng chứng khác.",
        );
      if (attempt === 23) onSlowScan?.();
      if (attempt === 47) throw new EvidenceScanPending();
      await sleep(
        attempt < 23 ? Math.min(500 * 2 ** attempt, 3000) : 5000,
        signal,
      );
    }
  } catch (error) {
    const failure = signal.aborted
      ? new Error("Quá trình gửi đã tạm dừng. Hãy bấm gửi lại để tiếp tục.")
      : error;
    update({
      ...file,
      checking: false,
      error: scanError(failure),
    });
    throw failure;
  }
  return file;
}
