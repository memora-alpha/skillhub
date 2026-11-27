"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useState } from "react";
import { userErrorText } from "../api/client";
import { Feedback } from "../components/common";
import styles from "./chat.module.css";

async function fetchAttachmentBlob(url: string, signal?: AbortSignal) {
  let response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (response.status === 401) {
    const refreshed = await fetch("/api/user/session/refresh", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
    }).catch(() => null);
    if (refreshed?.ok) {
      response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal,
      });
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const code =
      typeof body?.message === "string"
        ? body.message
        : "ATTACHMENT_NOT_AVAILABLE";
    throw new Error(userErrorText(response.status, code));
  }
  return response.blob();
}

export function ChatImagePreview({
  conversationId,
  messageId,
  attachmentId,
  filename,
  width,
  height,
}: Readonly<{
  conversationId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  width?: number | null;
  height?: number | null;
}>) {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    let objectUrl: string | undefined;
    const url =
      "/api/user/conversations/" +
      conversationId +
      "/messages/" +
      messageId +
      "/attachments/" +
      attachmentId +
      "/preview";
    void fetchAttachmentBlob(url, abort.signal)
      .then((blob) => {
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, messageId, attachmentId]);

  if (failed || !src) return null;
  return (
    <div className={styles.imagePreviewWrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.imagePreview}
        src={src}
        alt={filename}
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
      />
    </div>
  );
}

export function ChatDownload({
  conversationId,
  messageId,
  attachmentId,
  filename,
}: Readonly<{
  conversationId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    let objectUrl: string | undefined;
    try {
      const url =
        "/api/user/conversations/" +
        conversationId +
        "/messages/" +
        messageId +
        "/attachments/" +
        attachmentId +
        "/content";
      const blob = await fetchAttachmentBlob(url);
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener noreferrer";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, 15_000);
    } catch (cause) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setError(
        cause instanceof Error ? cause.message : "Không thể tải tệp đính kèm.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LoadingButton
        type="button"
        className="learner-text-button"
        disabled={busy}
        onClick={() => void handleDownload()}
        loading={busy}
      >
        {busy ? "Đang tải tệp…" : "Tải " + filename}
      </LoadingButton>
      <Feedback error={error} />
    </div>
  );
}
