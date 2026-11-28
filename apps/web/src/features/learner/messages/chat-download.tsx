"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MessageAttachment } from "../types";
import { userErrorText } from "../api/client";
import { ProductIcon } from "../components/product-icon";
import {
  attachmentBadgeInfo,
  attachmentMetaText,
  imageBoxDimensions,
} from "./chat-attachment-display";
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

function useAttachmentDownload(
  conversationId: string,
  messageId: string,
  attachmentId: string,
  filename: string,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const busyRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const download = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
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
      if (activeRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải tệp đính kèm.",
        );
      }
    } finally {
      busyRef.current = false;
      if (activeRef.current) setBusy(false);
    }
  }, [conversationId, messageId, attachmentId, filename]);

  return { busy, error, download };
}

export function ChatFileAttachment({
  conversationId,
  messageId,
  file,
  mine,
}: Readonly<{
  conversationId: string;
  messageId: string;
  file: MessageAttachment;
  mine: boolean;
}>) {
  const { busy, error, download } = useAttachmentDownload(
    conversationId,
    messageId,
    file.attachmentId,
    file.filename,
  );
  const badge = attachmentBadgeInfo(file);
  const metaText = attachmentMetaText(file);

  return (
    <div className={styles.fileItem}>
      <button
        type="button"
        className={styles.fileCard + (mine ? " " + styles.fileCardMine : "")}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label={
          busy
            ? `Đang tải xuống ${file.filename}`
            : `Tải xuống ${file.filename}`
        }
        title={file.filename}
        onClick={() => {
          void download();
        }}
      >
        <span
          className={styles.fileBadge}
          data-tone={badge.tone}
          aria-hidden="true"
        >
          <ProductIcon
            name={badge.tone === "image" ? "image" : "file"}
            size={17}
          />
          <span className={styles.fileBadgeExt}>{badge.ext}</span>
        </span>
        <span className={styles.fileInfo}>
          <span className={styles.fileName}>{file.filename}</span>
          <span className={styles.fileMeta} data-busy={busy || undefined}>
            {busy ? "Đang tải xuống…" : metaText}
          </span>
        </span>
        <span
          className={styles.fileAction}
          data-busy={busy || undefined}
          aria-hidden="true"
        >
          {busy ? (
            <span className={styles.miniSpinner} />
          ) : (
            <ProductIcon name="download" size={16} />
          )}
        </span>
      </button>
      {error && (
        <p className={styles.attachmentError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type PreviewState = {
  key: string;
  src?: string;
  failed: boolean;
};

export function ChatImageAttachment({
  conversationId,
  messageId,
  file,
  mine,
  grouped = false,
  onMediaLoad,
}: Readonly<{
  conversationId: string;
  messageId: string;
  file: MessageAttachment;
  mine: boolean;
  grouped?: boolean;
  onMediaLoad?: () => void;
}>) {
  const key = `${conversationId}:${messageId}:${file.attachmentId}`;
  const [preview, setPreview] = useState<PreviewState>({
    key,
    failed: false,
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { busy, error, download } = useAttachmentDownload(
    conversationId,
    messageId,
    file.attachmentId,
    file.filename,
  );

  useEffect(() => {
    const abort = new AbortController();
    let objectUrl: string | undefined;
    const url =
      "/api/user/conversations/" +
      conversationId +
      "/messages/" +
      messageId +
      "/attachments/" +
      file.attachmentId +
      "/preview";
    void fetchAttachmentBlob(url, abort.signal)
      .then((blob) => {
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ key, src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setPreview({ key, failed: true });
        }
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, conversationId, messageId, file.attachmentId]);

  const current = preview.key === key ? preview : { key, failed: false };
  const box = grouped ? null : imageBoxDimensions(file.width, file.height);

  if (current.failed) {
    return (
      <ChatFileAttachment
        conversationId={conversationId}
        messageId={messageId}
        file={file}
        mine={mine}
      />
    );
  }

  const tileStyle = box
    ? { width: `${box.width}px`, aspectRatio: `${box.width} / ${box.height}` }
    : undefined;

  return (
    <div className={styles.imageItem} data-grouped={grouped || undefined}>
      <div
        className={styles.imageTile}
        data-grouped={grouped || undefined}
        data-sized={box ? "true" : undefined}
        data-cropped={box?.cropped ? "true" : undefined}
        style={tileStyle}
      >
        {current.src ? (
          <>
            <button
              type="button"
              className={styles.imageOpenBtn}
              aria-label={`Xem ảnh ${file.filename}`}
              title={`Xem ảnh ${file.filename}`}
              onClick={() => setLightboxOpen(true)}
            >
              {/* Authenticated blob preview URL; Next Image optimization is unavailable for local object URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.imagePreview}
                src={current.src}
                alt={file.filename}
                width={file.width ?? undefined}
                height={file.height ?? undefined}
                loading="lazy"
                onLoad={onMediaLoad}
              />
            </button>
            <button
              type="button"
              className={styles.imageDownloadBtn}
              data-busy={busy || undefined}
              disabled={busy}
              aria-busy={busy || undefined}
              aria-label={
                busy
                  ? `Đang tải xuống ${file.filename}`
                  : `Tải xuống ${file.filename}`
              }
              title={busy ? "Đang tải xuống…" : "Tải ảnh xuống"}
              onClick={() => {
                void download();
              }}
            >
              {busy ? (
                <span className={styles.miniSpinnerLight} />
              ) : (
                <ProductIcon name="download" size={15} />
              )}
            </button>
          </>
        ) : (
          <div
            className={styles.imageSkeleton}
            role="status"
            aria-label={`Đang tải ảnh ${file.filename}`}
          >
            <ProductIcon name="image" size={24} />
          </div>
        )}
      </div>
      {error && (
        <p className={styles.attachmentError} role="alert">
          {error}
        </p>
      )}
      {lightboxOpen && current.src && (
        <ChatImageLightbox
          src={current.src}
          file={file}
          busy={busy}
          error={error}
          onDownload={() => {
            void download();
          }}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function ChatImageLightbox({
  src,
  file,
  busy,
  error,
  onDownload,
  onClose,
}: Readonly<{
  src: string;
  file: MessageAttachment;
  busy: boolean;
  error?: string;
  onDownload: () => void;
  onClose: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const metaParts = [attachmentMetaText(file)];
  if (file.width && file.height) {
    metaParts.push(`${file.width} × ${file.height}`);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.lightbox}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className={styles.lightboxScrimBtn}
        aria-label="Đóng xem ảnh"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className={styles.lightboxFrame}>
        <header className={styles.lightboxHeader}>
          <div className={styles.lightboxTitle}>
            <strong id={titleId} title={file.filename}>
              {file.filename}
            </strong>
            <small>{metaParts.join(" · ")}</small>
          </div>
          <div className={styles.lightboxActions}>
            <button
              type="button"
              className={styles.lightboxDownload}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onDownload}
            >
              {busy ? (
                <span className={styles.miniSpinnerLight} />
              ) : (
                <ProductIcon name="download" size={16} />
              )}
              <span>{busy ? "Đang tải…" : "Tải xuống"}</span>
            </button>
            <button
              type="button"
              className={styles.lightboxClose}
              aria-label="Đóng xem ảnh"
              onClick={onClose}
            >
              <ProductIcon name="close" size={18} />
            </button>
          </div>
        </header>
        {error && (
          <p className={styles.lightboxError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.lightboxStage}>
          {/* Authenticated blob preview URL; Next Image optimization is unavailable for local object URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.lightboxImage} src={src} alt={file.filename} />
        </div>
      </div>
    </dialog>
  );
}
