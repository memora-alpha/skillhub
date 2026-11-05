"use client";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { safeDownloadUrl } from "../account/view-policy";
import { useClock } from "../hooks/use-clock";
import { Feedback } from "../components/common";
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
  const { request } = useUserSession();
  const [download, setDownload] = useState<{
    url: string;
    expiresAt: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const now = useClock();
  return (
    <div>
      {download && Date.parse(download.expiresAt) > now ? (
        <a
          className="learner-card-link"
          href={download.url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Tải {filename} ↗
        </a>
      ) : (
        <button
          type="button"
          className="learner-text-button"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError(undefined);
            setDownload(undefined);
            try {
              const result = await request<{ url: string; expiresAt: string }>(
                "conversations/" +
                  conversationId +
                  "/messages/" +
                  messageId +
                  "/attachments/" +
                  attachmentId +
                  "/download",
              );
              if (
                !safeDownloadUrl(result.data.url) ||
                !Number.isFinite(Date.parse(result.data.expiresAt)) ||
                Date.parse(result.data.expiresAt) <= Date.now()
              )
                throw new Error(
                  "Liên kết tải không hợp lệ hoặc đã hết hạn. Hãy kiểm tra lại quyền tải.",
                );
              setDownload(result.data);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Không thể lấy liên kết tải.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Đang kiểm tra quyền tải…" : "Lấy liên kết tải " + filename}
        </button>
      )}
      <Feedback error={error} />
    </div>
  );
}
