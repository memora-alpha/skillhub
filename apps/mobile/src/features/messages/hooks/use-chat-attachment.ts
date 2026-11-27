import { useEffect, useRef, useState } from "react";
import { useConnections } from "@/features/connections";
import { useChatOutbox } from "../context/ChatOutbox";
import { validateChatFile, type ChatFile } from "../utils/chat-file";
import {
  pickChatAttachment,
  type ChatAttachmentSource,
} from "../utils/pick-chat-attachment";
import {
  prepareChatImage,
  CHAT_IMAGE_COMPRESSION_BYTES,
} from "../utils/prepare-chat-image";
import {
  importPastedChatImage,
  type ChatImagePaste,
} from "../utils/import-pasted-chat-image";

function release(file?: ChatFile) {
  try {
    file?.cleanup?.();
  } catch {
    /* Cache cleanup does not invalidate a selection. */
  }
}

export function useChatAttachment(id: string) {
  const runtime = useConnections();
  const outbox = useChatOutbox(id);
  const [file, setFile] = useState<ChatFile>();
  const selected = useRef<ChatFile | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [errorSource, setErrorSource] = useState<
    ChatAttachmentSource | "clipboard"
  >();
  const busy = useRef(false);
  const mounted = useRef(true);
  const latestId = useRef(id);
  latestId.current = id;
  const isCurrent = () =>
    mounted.current && latestId.current === id && runtime.isCurrent();
  const work = useRef<AbortController | undefined>(undefined);
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const clearSelection = () => {
    work.current?.abort();
    release(selected.current);
    selected.current = undefined;
    preparingRef.current = false;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearSelection();
    };
  }, [id, runtime.key]);
  const select = async (
    source: ChatAttachmentSource | "clipboard",
    load: () => Promise<ChatFile | undefined>,
  ) => {
    if (busy.current || !isCurrent()) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setErrorSource(source);
    try {
      const next = await load();
      if (!next) return;
      if (!isCurrent()) {
        release(next);
        return;
      }
      try {
        validateChatFile(next);
      } catch (error) {
        release(next);
        throw error;
      }
      clearSelection();
      const control = new AbortController();
      work.current = control;
      const current = () =>
        mounted.current &&
        work.current === control &&
        !control.signal.aborted &&
        isCurrent();
      selected.current = next;
      setFile(next);
      const image = next.mimeType?.startsWith("image/");
      const compress =
        !!image && (next.size ?? 0) > CHAT_IMAGE_COMPRESSION_BYTES;
      preparingRef.current = compress;
      setPreparing(compress);
      if (compress)
        void prepareChatImage(next, control.signal)
          .catch(() => next)
          .then((prepared) => {
            if (!current()) {
              if (prepared !== next) release(prepared);
              return;
            }
            selected.current = prepared;
            setFile(prepared);
            preparingRef.current = false;
            setPreparing(false);
          });
    } catch (cause) {
      if (isCurrent()) setError(cause);
    } finally {
      busy.current = false;
      if (isCurrent()) setPending(false);
    }
  };
  const send = (text: string) => {
    const next = selected.current;
    if (
      !next ||
      busy.current ||
      preparingRef.current ||
      !isCurrent() ||
      !outbox.attachmentReady ||
      outbox.offline
    )
      return false;
    if (!outbox.sendAttachment(text, next)) return false;
    work.current?.abort();
    selected.current = undefined;
    setFile(undefined);
    setError(undefined);
    return true;
  };
  return {
    file,
    pending,
    preparing,
    error,
    errorSource,
    locked: pending,
    choose: (source: ChatAttachmentSource = "files") =>
      select(source, () => pickChatAttachment(source)),
    paste: (image: ChatImagePaste) =>
      select("clipboard", () => importPastedChatImage(image)),
    send,
    ready:
      !!file &&
      !pending &&
      !preparing &&
      outbox.attachmentReady &&
      !outbox.offline,
    remove: () => {
      if (!busy.current) {
        clearSelection();
        setFile(undefined);
        setError(undefined);
        setPreparing(false);
      }
    },
  };
}
