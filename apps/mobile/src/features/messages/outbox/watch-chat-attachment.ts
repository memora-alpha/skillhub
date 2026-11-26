import { AppError } from "@/lib/http/errors";
import {
  UploadScanPending,
  UPLOAD_SCAN_TIMEOUT_MS,
} from "@/lib/http/watch-upload-status";
import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import {
  requireReadyAttachment,
  AttachmentSendError,
} from "./attachment-errors";

// Chat can publish a pending card; the generic upload monitor waits for final approval.
export async function waitForChatAttachment(options: {
  read(signal: AbortSignal): Promise<ChatFileStatus>;
  active(): boolean;
  signal: AbortSignal;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  now(): number;
}) {
  const started = options.now();
  let failedReads = 0;
  while (options.active() && !options.signal.aborted) {
    const elapsed = options.now() - started;
    if (elapsed >= UPLOAD_SCAN_TIMEOUT_MS) throw new UploadScanPending();
    try {
      const status = await options.read(options.signal);
      if (!options.active() || options.signal.aborted) return;
      failedReads = 0;
      requireReadyAttachment(status);
      return;
    } catch (error) {
      if (!options.active() || options.signal.aborted) return;
      if (error instanceof AttachmentSendError) {
        if (error.code !== "CHAT_ATTACHMENT_PENDING") throw error;
      } else {
        const temporary =
          error instanceof AppError &&
          (error.kind === "network" ||
            (error.kind === "http" && error.status >= 500));
        if (!temporary || ++failedReads > 2) throw error;
      }
    }
    const delay = elapsed < 10_000 ? 1000 : elapsed < 30_000 ? 2000 : 5000;
    await options.sleep(
      Math.min(delay, UPLOAD_SCAN_TIMEOUT_MS - elapsed),
      options.signal,
    );
  }
}
