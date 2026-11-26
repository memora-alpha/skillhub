import { useEffect, useState } from "react";
import type { ApiMessage } from "../api/messages-api";
import { useChatImagePreview } from "../hooks/use-chat-image-preview";
import { canDownloadAttachment } from "../utils/attachment-availability";
import { ChatImageCard } from "./ChatImageCard";
import { useSentChatImage } from "../hooks/use-sent-chat-image";

type Props = Readonly<{
  message: ApiMessage;
  file: ApiMessage["attachments"][number];
  mine: boolean;
  pending: boolean;
  onDownload: () => void;
  downloadError?: string;
}>;

export function ChatImageMessage(props: Props) {
  const { file, message } = props;
  const local = useSentChatImage(message, file);
  const [unavailableFor, setUnavailableFor] = useState<string>();
  const identity = JSON.stringify([
    message.conversationId,
    message.id,
    file.attachmentId,
    file.fileId,
    file.accessStatus,
    file.availability,
    file.moderationStatus,
  ]);
  const availability = file.accessStatus ?? file.availability;
  if (file.moderationStatus === "REVIEW_REQUIRED")
    return <ChatImageCard filename={file.filename} status="review" />;
  if (canDownloadAttachment(availability) && unavailableFor !== identity)
    return (
      <AvailableChatImage
        {...props}
        localUri={local.uri}
        releaseLocal={local.release}
        onUnavailable={() => {
          local.release();
          setUnavailableFor(identity);
        }}
      />
    );
  return (
    <ChatImageCard
      filename={file.filename}
      uri={
        availability === "PENDING_SCAN" && props.mine ? local.uri : undefined
      }
      status={
        availability === "PENDING_SCAN"
          ? props.mine && local.uri
            ? undefined
            : "pending"
          : "unavailable"
      }
    />
  );
}

// Unmounting this branch on revocation closes the viewer and disposes both files.
function AvailableChatImage({
  message,
  file,
  pending,
  onDownload,
  downloadError,
  onUnavailable,
  localUri,
  releaseLocal,
}: Props & {
  onUnavailable: () => void;
  localUri?: string;
  releaseLocal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const thumbnail = useChatImagePreview(
    message,
    file,
    "thumbnail",
    true,
    onUnavailable,
  );
  const preview = useChatImagePreview(
    message,
    file,
    "preview",
    open,
    onUnavailable,
  );
  useEffect(() => {
    if (thumbnail.uri && (!open || preview.uri)) releaseLocal();
  }, [thumbnail.uri, preview.uri, open, releaseLocal]);
  return (
    <ChatImageCard
      filename={file.filename}
      uri={thumbnail.uri ?? localUri}
      loading={thumbnail.loading}
      error={localUri ? undefined : thumbnail.error}
      onError={thumbnail.uri ? thumbnail.imageFailed : releaseLocal}
      onRetry={thumbnail.retry}
      previewUri={preview.uri ?? localUri}
      previewError={localUri ? undefined : preview.error}
      onPreviewError={preview.imageFailed}
      onPreviewRetry={preview.retry}
      onOpenChange={setOpen}
      onDownload={onDownload}
      downloadError={downloadError}
      pending={pending}
    />
  );
}
