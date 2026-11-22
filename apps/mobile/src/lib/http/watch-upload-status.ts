import {
  fileModerationStatusSchema,
  type FileModerationStatus,
  type UploadedFile,
  type UploadStatus,
} from "./file-upload";
import { AppError } from "./errors";

export const UPLOAD_SCAN_TIMEOUT_MS = 240_000;
export const UPLOAD_SCAN_PENDING_MESSAGE =
  "Máy chủ vẫn chưa kiểm tra xong tệp. Bạn có thể thử lại việc kiểm tra, không cần tải tệp lên lần nữa.";
export class UploadScanPending extends Error {
  constructor() {
    super(UPLOAD_SCAN_PENDING_MESSAGE);
  }
}
export function uploadNeedsCheck(
  state: string,
  moderationStatus?: FileModerationStatus,
) {
  return (
    ["UPLOADING", "QUARANTINED", "SCANNING"].includes(state) &&
    moderationStatus !== "REVIEW_REQUIRED" &&
    moderationStatus !== "FAILED"
  );
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
function uploadCheckDelay(elapsed: number) {
  if (elapsed < 10_000) return 1000;
  if (elapsed < 30_000) return 2000;
  return 5000;
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
  read: (id: string, signal: AbortSignal) => Promise<UploadStatus>;
  update: (files: UploadedFile[]) => void;
  active: () => boolean;
  signal: AbortSignal;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}) {
  const started = now();
  let failedReads = 0;
  while (active() && !signal.aborted) {
    const waiting = files().filter((file) =>
      uploadNeedsCheck(file.state, file.moderationStatus),
    );
    if (!waiting.length) return;
    if (now() - started >= UPLOAD_SCAN_TIMEOUT_MS)
      throw new UploadScanPending();
    const results = await Promise.all(
      waiting.map(async (file) => {
        const row = await read(file.fileId, signal);
        if (row.fileId !== file.fileId) throw new AppError("protocol");
        if (
          row.moderationStatus !== undefined &&
          !fileModerationStatusSchema.safeParse(row.moderationStatus).success
        )
          throw new AppError("protocol");
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
    ).catch((cause: unknown) => {
      if (!active() || signal.aborted) return undefined;
      failedReads++;
      const temporary =
        cause instanceof AppError &&
        (cause.kind === "network" ||
          (cause.kind === "http" && cause.status >= 500));
      if (!temporary || failedReads > 2) throw cause;
      return undefined;
    });
    if (!active() || signal.aborted) return;
    if (results) failedReads = 0;
    const next = files().map((file) => {
      if (!results) return file;
      const row = results.find((result) => result.fileId === file.fileId);
      if (!row || !uploadNeedsCheck(file.state, file.moderationStatus))
        return file;
      const updated = { ...file, state: row.state };
      if (row.moderationStatus === undefined) delete updated.moderationStatus;
      else updated.moderationStatus = row.moderationStatus;
      return updated;
    });
    if (results) update(next);
    if (
      !next.some((file) => uploadNeedsCheck(file.state, file.moderationStatus))
    )
      return;
    const elapsed = now() - started;
    const remaining = UPLOAD_SCAN_TIMEOUT_MS - elapsed;
    if (remaining <= 0) throw new UploadScanPending();
    await sleep(Math.min(uploadCheckDelay(elapsed), remaining), signal);
  }
}
