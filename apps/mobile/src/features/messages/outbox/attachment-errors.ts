import type { ChatFileStatus } from "../api/chat-attachment-contracts";
import { chatFailureCopy } from "../utils/chat-failure-copy";

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

type AttachmentStatus = Pick<
  ChatFileStatus,
  "state" | "moderationStatus" | "availability" | "accessStatus" | "canAttach"
>;

export function attachmentCanSend(status: AttachmentStatus) {
  if (status.canAttach !== undefined) return status.canAttach;
  return status.state === "READY" && status.moderationStatus === undefined;
}

export function requireReadyAttachment(status: AttachmentStatus) {
  const availability = status.accessStatus ?? status.availability;
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
