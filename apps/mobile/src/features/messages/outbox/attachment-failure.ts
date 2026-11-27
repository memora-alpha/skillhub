import { AppError, errorMessage } from "@/lib/http/errors";
import { filePickerError } from "@/lib/http/file-picker-error";
import { AttachmentSendError } from "./attachment-errors";
import type { QueuedText } from "./outbox-types";

export type AttachmentStage = "upload" | "status" | "send";

function normalizeAttachmentError(cause: unknown) {
  if (
    cause instanceof AppError &&
    ["CHAT_UPLOAD_KEY_CONFLICT", "CHAT_UPLOAD_RESTART_REQUIRED"].includes(
      cause.code,
    )
  )
    return new AttachmentSendError(
      "Không thể tiếp tục lần tải này. Chọn lại tệp.",
      "CHAT_FILE_UPLOAD_RESTART_REQUIRED",
    );
  return cause;
}

export function attachmentFailure(
  cause: unknown,
  stage: AttachmentStage,
  timedOut: boolean,
  interrupted: boolean,
): Partial<QueuedText> {
  if (timedOut)
    return {
      state: "failed",
      failureCode: "CHAT_ATTACHMENT_TIMEOUT",
      failure: "Tệp chưa gửi xong. Bấm Thử lại để kiểm tra tiếp.",
    };
  if (interrupted)
    return {
      state: "failed",
      failureCode: "CHAT_ATTACHMENT_INTERRUPTED",
      failure: "Lần gửi tệp bị gián đoạn. Bấm Thử lại để tiếp tục.",
    };
  const error = normalizeAttachmentError(cause);
  let failureCode: string | undefined;
  if (error instanceof AppError || error instanceof AttachmentSendError)
    failureCode = error.code;
  let failure: string;
  if (error instanceof AttachmentSendError) failure = error.message;
  else if (stage === "send") failure = errorMessage(error);
  else failure = filePickerError(error, stage);
  return { state: "failed", failureCode, failure };
}
