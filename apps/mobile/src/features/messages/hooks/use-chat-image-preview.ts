import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import type { ApiMessage } from "../api/messages-api";
import { canDownloadAttachment } from "../utils/attachment-availability";
import {
  createChatMediaFile,
  type ChatMediaFile,
} from "../utils/chat-media-file";
import { reloadChatEventQueries } from "../utils/event-hydration";
import { useMessagesApi } from "./use-messages-api";

export function useChatImagePreview(
  message: ApiMessage,
  file: ApiMessage["attachments"][number],
  variant: "thumbnail" | "preview" = "thumbnail",
  enabled = true,
  onUnavailable?: () => void,
) {
  const api = useMessagesApi();
  const runtime = useConnections();
  const { isCurrent, assertCurrent, key } = runtime;
  const cache = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{
    identity: string;
    uri?: string;
    error?: string;
  }>();
  const identity = JSON.stringify([
    runtime.key,
    message.conversationId,
    message.id,
    file.attachmentId,
    file.fileId,
    file.availability,
    file.accessStatus,
    file.moderationStatus,
    file.thumbnailUrlEndpoint,
    file.previewUrlEndpoint,
    variant,
    enabled,
    attempt,
  ]);
  const latest = useRef(identity);
  latest.current = identity;
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  const allowed =
    enabled && canDownloadAttachment(file.accessStatus ?? file.availability);
  useEffect(() => {
    if (!allowed || !isCurrent()) return;
    const control = new AbortController();
    let media: ChatMediaFile | undefined;
    const current = () =>
      !control.signal.aborted && latest.current === identity && isCurrent();
    const derivative =
      variant === "thumbnail"
        ? file.thumbnailUrlEndpoint
        : file.previewUrlEndpoint;
    // Legacy metadata may lack derivatives. The original is still fetched with auth.
    void api
      .content(
        message.conversationId,
        message.id,
        file.attachmentId,
        derivative ? variant : "content",
        control.signal,
      )
      .then((bytes) => {
        if (!current()) return;
        media = createChatMediaFile(
          bytes,
          derivative ? "image/webp" : file.mimeType,
        );
        if (!current()) {
          media.dispose();
          media = undefined;
          return;
        }
        setPreview({ identity, uri: media.uri });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        const revoked =
          error instanceof AppError &&
          (error.status === 403 ||
            error.status === 404 ||
            error.status === 410 ||
            error.code === "CONTENT_MODERATION_BLOCKED");
        setPreview({
          identity,
          error: revoked
            ? "Ảnh không còn khả dụng."
            : "Không tải được ảnh xem trước.",
        });
        if (revoked) unavailable.current?.();
        if (error instanceof AppError && (revoked || error.status === 409))
          void reloadChatEventQueries(
            cache,
            key,
            [["thread", message.conversationId]],
            undefined,
            assertCurrent,
            message.conversationId,
          ).catch(() => {});
      });
    return () => {
      control.abort();
      media?.dispose();
    };
  }, [
    identity,
    allowed,
    api,
    isCurrent,
    assertCurrent,
    key,
    cache,
    message.conversationId,
    message.id,
    file.attachmentId,
    file.thumbnailUrlEndpoint,
    file.previewUrlEndpoint,
    file.mimeType,
    variant,
  ]);
  const visible = allowed && isCurrent() && preview?.identity === identity;
  return {
    uri: visible ? preview.uri : undefined,
    error: visible ? preview.error : undefined,
    loading: allowed && isCurrent() && !visible,
    retry: () => setAttempt((value) => value + 1),
    imageFailed: () => {
      if (latest.current === identity && isCurrent())
        setPreview({ identity, error: "Không đọc được ảnh." });
    },
  };
}
