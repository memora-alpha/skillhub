import type { ApiMessage } from "../api/messages-api";
import { isChatImage } from "../utils/chat-attachment-kind";
import { ChatFileCard } from "./ChatFileCard";
import { ChatImageMessage } from "./ChatImageMessage";
import { ChatAttachmentRecovery } from "./ChatAttachmentRecovery";

export function ChatMessageAttachment(
  props: Readonly<{
    message: ApiMessage;
    file: ApiMessage["attachments"][number];
    mine: boolean;
    pending: boolean;
    disabled: boolean;
    onDownload: () => void;
    downloadError?: string;
  }>,
) {
  const { message, file, mine, pending, disabled, onDownload } = props;
  const content = isChatImage(file.mimeType) ? (
    <ChatImageMessage {...props} />
  ) : (
    <ChatFileCard
      filename={file.filename}
      mimeType={file.mimeType}
      bytes={file.fileSizeBytes}
      availability={file.availability}
      moderationStatus={file.moderationStatus}
      mine={mine}
      pending={pending}
      disabled={disabled}
      onPress={onDownload}
    />
  );
  return (
    <>
      {content}
      {mine &&
        file.moderationStatus === "FAILED" &&
        (file.accessStatus ?? file.availability) === "UNAVAILABLE" && (
          <ChatAttachmentRecovery
            key={`${message.id}:${file.fileId}:${file.attachmentId}`}
            message={message}
            file={file}
          />
        )}
    </>
  );
}
