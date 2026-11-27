import { useLayoutEffect, useRef, useState } from "react";
import { prepareChatDownload } from "../utils/chat-media-file";
import { useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import { useConnections } from "@/features/connections";
import type { ApiMessage } from "../api/messages-api";
import { useMessagesApi } from "./use-messages-api";
import { canDownloadAttachment } from "../utils/attachment-availability";
import { reloadChatEventQueries } from "../utils/event-hydration";

export function useChatAttachmentDownload(message: ApiMessage) {
  const runtime = useConnections(),
    api = useMessagesApi(),
    cache = useQueryClient();
  const latest = useRef({ message, isCurrent: runtime.isCurrent });
  latest.current = { message, isCurrent: runtime.isCurrent };
  const downloading = useRef(false);
  const mounted = useRef(true);
  const activeDownload = useRef<AbortController | undefined>(undefined);
  const attachmentState = JSON.stringify(
    message.attachments.map((file) => [
      file.attachmentId,
      file.fileId,
      file.availability,
      file.accessStatus,
      file.moderationStatus,
    ]),
  );
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeDownload.current?.abort();
    };
  }, [message.id, message.conversationId, attachmentState, runtime.key]);
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState<string>();
  const [feedbackFor, setFeedbackFor] = useState<string>();
  const download = async (attachmentId: string) => {
    const file = message.attachments.find(
      (item) => item.attachmentId === attachmentId,
    );
    const current = () => {
      const target = latest.current.message;
      return (
        mounted.current &&
        runtime.isCurrent() &&
        latest.current.isCurrent() &&
        target.id === message.id &&
        target.conversationId === message.conversationId
      );
    };
    const readable = () => {
      const updated = latest.current.message.attachments.find(
        (item) => item.attachmentId === attachmentId,
      );
      return (
        current() &&
        !!file &&
        updated?.fileId === file.fileId &&
        canDownloadAttachment(updated.availability)
      );
    };
    if (downloading.current || !readable()) return;
    downloading.current = true;
    setPending(attachmentId);
    setError(undefined);
    setFeedbackFor(attachmentId);
    const control = new AbortController();
    activeDownload.current = control;
    try {
      const save = await prepareChatDownload(file!.filename, file!.mimeType);
      if (!save || !readable() || control.signal.aborted) return;
      const bytes = await api.content(
        message.conversationId,
        message.id,
        attachmentId,
        "content",
        control.signal,
      );
      // A response received after revocation must never be saved.
      if (!readable() || control.signal.aborted) return;
      await save(bytes, control.signal);
    } catch (cause) {
      if (!current() || control.signal.aborted) return;
      setError(cause);
      if (cause instanceof AppError && cause.status === 409)
        void reloadChatEventQueries(
          cache,
          runtime.key,
          [["thread", message.conversationId]],
          undefined,
          runtime.assertCurrent,
          message.conversationId,
        ).catch(() => {});
    } finally {
      if (activeDownload.current === control)
        activeDownload.current = undefined;
      downloading.current = false;
      if (current()) setPending(undefined);
    }
  };
  return { error, pending, feedbackFor, download };
}
