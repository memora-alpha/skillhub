import type { ApiMessage } from "../api/messages-api";
import { isChatImage } from "../utils/chat-attachment-kind";
import { ChatFileCard } from "./ChatFileCard";
import { ChatImageMessage } from "./ChatImageMessage";

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
  const { file, mine, pending, disabled, onDownload } = props;
  return isChatImage(file.mimeType) ? (
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
}
