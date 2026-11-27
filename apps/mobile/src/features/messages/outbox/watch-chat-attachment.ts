import {
  UploadScanPending,
  UPLOAD_SCAN_TIMEOUT_MS,
  isTemporaryUploadReadError,
  uploadCheckDelay,
} from "@/lib/http/watch-upload-status";
import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import {
  requireReadyAttachment,
  AttachmentSendError,
} from "./attachment-errors";

function pendingReadFailure(error: unknown, failedReads: number) {
  if (error instanceof AttachmentSendError) {
    if (error.code !== "CHAT_ATTACHMENT_PENDING") throw error;
    return failedReads;
  }
  if (!isTemporaryUploadReadError(error) || failedReads >= 2) throw error;
  return failedReads + 1;
}

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
  const active = () => options.active() && !options.signal.aborted;
  while (active()) {
    const elapsed = options.now() - started;
    if (elapsed >= UPLOAD_SCAN_TIMEOUT_MS) throw new UploadScanPending();
    try {
      // Polling must wait for each verdict before deciding whether another GET is needed.
      const status = await options.read(options.signal);
      if (!active()) return;
      failedReads = 0;
      requireReadyAttachment(status);
      return;
    } catch (error) {
      if (!active()) return;
      failedReads = pendingReadFailure(error, failedReads);
    }
    const delay = uploadCheckDelay(elapsed);
    // This delay provides backoff and the next iteration's deadline; it is sequential by design.
    await options.sleep(
      Math.min(delay, UPLOAD_SCAN_TIMEOUT_MS - elapsed),
      options.signal,
    );
  }
}
