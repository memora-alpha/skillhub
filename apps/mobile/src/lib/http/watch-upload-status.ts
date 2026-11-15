import type { UploadedFile } from "./file-upload";
import { AppError } from "./errors";

export const UPLOAD_SCAN_TIMEOUT_MS = 240_000;
export const UPLOAD_SCAN_PENDING_MESSAGE =
  "Máy chủ vẫn chưa kiểm tra xong tệp. Bạn có thể thử lại việc kiểm tra, không cần tải tệp lên lần nữa.";
export class UploadScanPending extends Error {
  constructor() {
    super(UPLOAD_SCAN_PENDING_MESSAGE);
  }
}
export function uploadNeedsCheck(state: string) {
  return ["UPLOADING", "QUARANTINED", "SCANNING"].includes(state);
}
export function waitForUploadCheck(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new Error("cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function watchUploadStatus({
  files,
  read,
  update,
  active,
  signal,
  sleep = waitForUploadCheck,
  now = Date.now,
}: {
  files: () => readonly UploadedFile[];
  read: (
    id: string,
    signal: AbortSignal,
  ) => Promise<{ fileId: string; state: string }>;
  update: (files: UploadedFile[]) => void;
  active: () => boolean;
  signal: AbortSignal;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}) {
  const started = now();
  while (active() && !signal.aborted) {
    const waiting = files().filter((file) => uploadNeedsCheck(file.state));
    if (!waiting.length) return;
    if (now() - started >= UPLOAD_SCAN_TIMEOUT_MS)
      throw new UploadScanPending();
    const results = await Promise.all(
      waiting.map(async (file) => {
        const row = await read(file.fileId, signal);
        if (row.fileId !== file.fileId) throw new AppError("protocol");
        if (
          !uploadNeedsCheck(row.state) &&
          ![
            "READY",
            "REJECTED",
            "SCAN_FAILED",
            "UPLOAD_FAILED",
            "CLEANUP_PENDING",
            "DELETED",
          ].includes(row.state)
        )
          throw new AppError("protocol");
        return row;
      }),
    );
    if (!active() || signal.aborted) return;
    const next = files().map((file) => {
      const row = results.find((result) => result.fileId === file.fileId);
      return row && uploadNeedsCheck(file.state)
        ? { ...file, state: row.state }
        : file;
    });
    update(next);
    if (!next.some((file) => uploadNeedsCheck(file.state))) return;
    const elapsed = now() - started;
    const remaining = UPLOAD_SCAN_TIMEOUT_MS - elapsed;
    if (remaining <= 0) throw new UploadScanPending();
    await sleep(
      Math.min(
        elapsed < 10_000 ? 1000 : elapsed < 30_000 ? 2000 : 5000,
        remaining,
      ),
      signal,
    );
  }
}
