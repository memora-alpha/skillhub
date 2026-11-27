import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import { chatFailureCopy } from "../utils/chat-failure-copy";
import type { QueuedText } from "./outbox-types";

const terminalStates = new Set([
  "REJECTED",
  "REVIEW_REQUIRED",
  "SCAN_FAILED",
  "FAILED",
  "DELETED",
  "CLEANUP_PENDING",
  "UPLOAD_FAILED",
  "BLOCKED",
]);

export class AttachmentSendError extends Error {
  constructor(
    message: string,
    readonly code = "CHAT_ATTACHMENT_PENDING",
  ) {
    super(message);
  }
}

export function isFinalAttachmentFailure(code?: string) {
  return !!code && code.startsWith("CHAT_FILE_");
}

// Old saved failures predate canRetry. A tap may re-read their server status;
// only a fresh canRetry=true response can authorize a new scan.
export function canRecheckQueuedAttachment(entry: QueuedText) {
  return (
    !!entry.attachment?.fileId &&
    [
      "CHAT_FILE_SCAN_FAILED",
      "CHAT_FILE_FAILED",
      "CHAT_FILE_REMOTE_UNAVAILABLE",
    ].includes(entry.failureCode ?? "")
  );
}

export function canRetryChatAttachment(
  status: Pick<ChatFileStatus, "canRetry" | "moderationStatus">,
) {
  return status.canRetry === true && status.moderationStatus === "FAILED";
}

type AttachmentStatus = Pick<
  ChatFileStatus,
  | "state"
  | "moderationStatus"
  | "availability"
  | "accessStatus"
  | "canAttach"
  | "canRetry"
>;

export function attachmentCanSend(status: AttachmentStatus) {
  if (status.canAttach !== undefined) return status.canAttach;
  return status.state === "READY" && status.moderationStatus === undefined;
}

export function requireReadyAttachment(status: AttachmentStatus) {
  const availability = status.accessStatus ?? status.availability;
  if (
    canRetryChatAttachment(status) &&
    availability !== "REVOKED" &&
    !["REJECTED", "BLOCKED", "DELETED", "CLEANUP_PENDING"].includes(
      status.state,
    )
  )
    throw new AttachmentSendError(
      chatFailureCopy("CHAT_ATTACHMENT_RETRYABLE")!,
      "CHAT_ATTACHMENT_RETRYABLE",
    );
  if (availability === "REVOKED")
    throw new AttachmentSendError(
      chatFailureCopy("CHAT_FILE_REVOKED")!,
      "CHAT_FILE_REVOKED",
    );
  if (availability === "UNAVAILABLE")
    throw new AttachmentSendError(
      chatFailureCopy("CHAT_FILE_REMOTE_UNAVAILABLE")!,
      "CHAT_FILE_REMOTE_UNAVAILABLE",
    );
  const problem = terminalStates.has(status.state)
    ? status.state
    : status.moderationStatus;
  if (problem && terminalStates.has(problem))
    throw new AttachmentSendError(
      chatFailureCopy(`CHAT_FILE_${problem}`)!,
      `CHAT_FILE_${problem}`,
    );
  if (!attachmentCanSend(status))
    throw new AttachmentSendError(chatFailureCopy("CHAT_ATTACHMENT_PENDING")!);
}
