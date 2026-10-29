import { useEffect, useRef, useState } from "react";
import { getDocumentAsync } from "expo-document-picker";
import { useConnections, useConnectionQuery } from "@/features/connections";
import { useMessagesApi } from "./use-messages-api";
import { useMessageSend } from "./use-message-send";
import {
  chatFormats,
  validateChatFile,
  chatFileFormData,
  type ChatFile,
} from "../utils/chat-file";

export function useChatAttachment(id: string) {
  const runtime = useConnections();
  const api = useMessagesApi();
  const sender = useMessageSend(id);
  const [file, setFile] = useState<ChatFile>();
  const [fileId, setFileId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<unknown>();
  const busy = useRef(false);
  const accepted = useRef(false);
  const caption = useRef("");
  const status = useConnectionQuery(
    ["chat-file", id, fileId],
    (signal) => api.fileStatus(id, fileId!, signal),
    !!fileId,
  );
  const locked =
    pending ||
    sender.pending ||
    sender.processing ||
    sender.uncertain ||
    submitted;
  const publicationFailed =
    sender.delivery.data &&
    sender.delivery.data.deliveryStatus !== "DELIVERED" &&
    !!sender.delivery.data.failureCode;
  const clear = () => {
    setFile(undefined);
    setFileId(undefined);
    setSubmitted(false);
    accepted.current = false;
    setError(undefined);
  };
  useEffect(() => {
    if (submitted && !sender.processing && runtime.isCurrent()) clear();
  }, [submitted, sender.processing, runtime]);
  const uploadFile = async (selected: ChatFile) => {
    const result = await api.upload(id, chatFileFormData(selected));
    if (runtime.isCurrent()) setFileId(result.fileId);
  };
  const choose = async () => {
    if (busy.current || accepted.current || locked || !runtime.isCurrent())
      return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await getDocumentAsync({
        type: Object.values(chatFormats),
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !runtime.isCurrent()) return;
      const selected = result.assets[0];
      if (!selected) return;
      validateChatFile(selected);
      setFile(selected);
      setFileId(undefined);
      await uploadFile(selected);
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
    } finally {
      busy.current = false;
      if (runtime.isCurrent()) setPending(false);
    }
  };
  const retryUpload = async () => {
    if (!file || fileId || busy.current || locked || !runtime.isCurrent())
      return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await uploadFile(file);
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
    } finally {
      busy.current = false;
      if (runtime.isCurrent()) setPending(false);
    }
  };
  const send = async (text: string) => {
    if (
      !fileId ||
      busy.current ||
      accepted.current ||
      locked ||
      status.error ||
      status.data?.state !== "READY" ||
      !runtime.isCurrent()
    )
      return false;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const latest = await status.refetch();
      if (
        latest.error ||
        latest.data?.state !== "READY" ||
        !runtime.isCurrent()
      ) {
        if (runtime.isCurrent()) setError(latest.error);
        return false;
      }
      caption.current = text;
      const sent = await sender.send(text, [fileId]);
      if (sent && runtime.isCurrent()) {
        accepted.current = true;
        setSubmitted(true);
      }
      return sent;
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
      return false;
    } finally {
      busy.current = false;
      if (runtime.isCurrent()) setPending(false);
    }
  };
  const retry = async () => {
    if (busy.current || sender.pending || !runtime.isCurrent()) return;
    busy.current = true;
    try {
      let sent;
      if (sender.uncertain) sent = await sender.retryPrevious();
      else if (publicationFailed) sent = await sender.retryPublication();
      else
        sent =
          (await sender.delivery.refetch()).data?.deliveryStatus ===
          "DELIVERED";
      if (sent && runtime.isCurrent()) {
        accepted.current = true;
        setSubmitted(true);
        return caption.current;
      }
    } catch (error_) {
      if (runtime.isCurrent()) setError(error_);
    } finally {
      busy.current = false;
    }
  };
  return {
    file,
    pending,
    locked,
    status,
    uploaded: !!fileId,
    ready:
      !!fileId && !status.error && status.data?.state === "READY" && !locked,
    processing: sender.processing,
    publicationFailed,
    uncertain: sender.uncertain,
    error: error ?? sender.error ?? sender.delivery.error,
    choose,
    send,
    retry,
    retryUpload,
    remove: () => {
      if (!busy.current && !accepted.current && !locked) clear();
    },
  };
}
