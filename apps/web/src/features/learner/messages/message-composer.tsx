"use client";
import {
  detectContactInformation,
  contactPolicyMessage,
} from "@/lib/chat/contact-policy";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useId, useRef, useState } from "react";
import { ProductIcon } from "../components/product-icon";
import styles from "./chat.module.css";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { BusinessFeedback } from "../components/business-feedback";
import { ChatFiles, type ChatUpload } from "./chat-files";
import { UserApiError } from "../api/client";
import {
  parseChatDraft,
  parseEditingDraft,
  type ChatDraft as Draft,
} from "./chat-draft";

function syncTextareaHeight(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = Math.min(element.scrollHeight, 128) + "px";
}

export function MessageComposer({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  const { actor, request, refresh } = useUserSession(),
    command = useUserCommand(true);
  const key = "skillhub-user-draft:" + actor.userId + ":" + conversationId;
  const fileInputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState<Draft | null>(() => {
    try {
      return parseChatDraft(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  });
  const [editing, setEditing] = useState(() => {
    try {
      return parseEditingDraft(sessionStorage.getItem(key + ":editing"));
    } catch {
      return null;
    }
  });
  const intent = useRef(saved),
    [text, setText] = useState(
      saved?.messageText ?? editing?.messageText ?? "",
    ),
    [notice, setNotice] = useState<{ tone: "error" | "info"; text: string }>(),
    [checking, setChecking] = useState(false),
    [draftRejected, setDraftRejected] = useState(false);
  const [files, setFiles] = useState<ChatUpload[]>(
    saved?.files ??
      saved?.attachmentFileIds.map((id) => ({
        id,
        filename: "Tệp đã gửi đang chờ kết quả",
        size: 0,
        state: "CHECKING",
      })) ??
      editing?.files ??
      [],
  );
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (saved) return;
    try {
      sessionStorage.setItem(
        key + ":editing",
        JSON.stringify({ messageText: text, files }),
      );
    } catch {
      /* Sending shows a persistence notice if storage is unavailable. */
    }
  }, [key, text, files, saved]);
  function clear() {
    intent.current = null;
    setSaved(null);
    setDraftRejected(false);
    setEditing(null);
    setText("");
    setFiles([]);
    setNotice(undefined);
    if (textareaRef.current) textareaRef.current.style.height = "";
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(key + ":editing");
    } catch {
      /* Memory state remains authoritative for this screen. */
    }
  }
  function isTerminalDraftRejection(cause: unknown) {
    return (
      cause instanceof UserApiError && [400, 409, 422].includes(cause.status)
    );
  }
  async function checkBeforeResend(draft: Draft) {
    setChecking(true);
    try {
      const receipt = await request<{ deliveryStatus: string }>(
        "conversations/" +
          conversationId +
          "/message-deliveries/" +
          draft.clientMessageId,
      );
      if (receipt.data.deliveryStatus === "DELIVERED") {
        clear();
        refresh();
        return false;
      }
      setDraftRejected(false);
      return true;
    } catch (cause) {
      if (cause instanceof UserApiError && cause.status === 404) {
        setDraftRejected(false);
        return true;
      }
      if (isTerminalDraftRejection(cause)) setDraftRejected(true);
      setNotice({
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Chưa kiểm tra được tin đang chờ.",
      });
      return false;
    } finally {
      setChecking(false);
    }
  }
  async function send() {
    const messageText = text.trim();
    if (
      (!messageText && !files.length) ||
      command.pending ||
      checking ||
      uploading
    )
      return;
    setNotice(undefined);
    if (!intent.current && files.some((file) => file.state !== "READY")) {
      setNotice({
        tone: "info",
        text: "Chờ tất cả tệp được kiểm tra sạch hoặc bỏ tệp chưa sẵn sàng trước khi gửi.",
      });
      return;
    }
    if (!intent.current && detectContactInformation(messageText)) {
      setNotice({ tone: "error", text: contactPolicyMessage });
      return;
    }
    if (intent.current && !(await checkBeforeResend(intent.current))) return;
    const body = intent.current ?? {
      clientMessageId: crypto.randomUUID(),
      messageText,
      attachmentFileIds: files.map((file) => file.id),
      files,
    };
    intent.current = body;
    setSaved(body);
    try {
      sessionStorage.setItem(key, JSON.stringify(body));
    } catch {
      setNotice({
        tone: "info",
        text: "Trình duyệt không lưu được bản gửi đang chờ; giữ màn hình này để kiểm tra kết quả.",
      });
    }
    let rejectedByPolicy = false;
    const result = await command.run(body.clientMessageId, async () => {
      try {
        return await request<{ deliveryStatus: string }>(
          "conversations/" + conversationId + "/messages",
          {
            method: "POST",
            body: {
              clientMessageId: body.clientMessageId,
              messageText: body.messageText,
              attachmentFileIds: body.attachmentFileIds,
            },
          },
        );
      } catch (cause) {
        if (
          cause instanceof UserApiError &&
          (cause.code === "CONTENT_MODERATION_BLOCKED" ||
            cause.code === "CONTACT_INFORMATION_NOT_ALLOWED")
        ) {
          rejectedByPolicy = true;
        }
        throw cause;
      }
    });
    if (rejectedByPolicy) {
      intent.current = null;
      setSaved(null);
      setDraftRejected(false);
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Keep editable memory draft. */
      }
      textareaRef.current?.focus();
    } else if (result?.data.deliveryStatus === "DELIVERED") {
      clear();
    } else if (result) {
      setNotice({
        tone: "info",
        text: "Máy chủ đang hoàn tất việc gửi. Kiểm tra trạng thái trước khi gửi nội dung khác.",
      });
    }
  }
  let sendLabel = saved ? "Kiểm tra rồi gửi lại cùng yêu cầu" : "Gửi tin nhắn";
  if (checking) sendLabel = "Đang kiểm tra tin đã gửi…";
  if (command.pending) sendLabel = "Đang gửi…";

  const activeAlert =
    command.error ?? (notice?.tone === "error" ? notice.text : undefined);
  let activeInfo: string | undefined;
  if (!activeAlert && !checking) {
    if (command.uncertain)
      activeInfo =
        "Chưa rõ kết quả lần gửi. Hãy kiểm tra tin đã gửi trước khi gửi tiếp.";
    else if (notice?.tone === "info") activeInfo = notice.text;
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {activeAlert && (
        <div className={styles.composerAlert} role="alert">
          <span>{activeAlert}</span>
          {!command.uncertain && (
            <button
              type="button"
              className={styles.bannerClose}
              aria-label="Đóng thông báo"
              onClick={() => {
                setNotice(undefined);
                command.resetAfterRead();
              }}
            >
              <ProductIcon name="close" size={14} />
            </button>
          )}
        </div>
      )}
      {command.failure && (
        <BusinessFeedback
          code={command.failure.code}
          details={command.failure.details}
        />
      )}
      {activeInfo && (
        <div className={styles.composerNotice}>
          <output>{activeInfo}</output>
          {!command.uncertain && (
            <button
              type="button"
              className={styles.bannerClose}
              aria-label="Đóng thông báo"
              onClick={() => setNotice(undefined)}
            >
              <ProductIcon name="close" size={14} />
            </button>
          )}
        </div>
      )}
      {saved && (
        <div className={styles.recoveryBar}>
          <LoadingButton
            className={styles.recoveryButton}
            type="button"
            disabled={checking || command.pending}
            onClick={() => {
              setChecking(true);
              void request<{ deliveryStatus: string }>(
                "conversations/" +
                  conversationId +
                  "/message-deliveries/" +
                  saved.clientMessageId,
              )
                .then((result) => {
                  if (result.data.deliveryStatus === "DELIVERED") {
                    clear();
                    refresh();
                  } else {
                    setNotice({
                      tone: "info",
                      text: "Tin nhắn vẫn đang xử lý. Bạn có thể kiểm tra lại.",
                    });
                  }
                })
                .catch((cause: unknown) => {
                  if (isTerminalDraftRejection(cause)) setDraftRejected(true);
                  setNotice({
                    tone: "error",
                    text:
                      cause instanceof Error
                        ? cause.message
                        : "Chưa kiểm tra được kết quả.",
                  });
                })
                .finally(() => setChecking(false));
            }}
            loading={!!(checking || command.pending)}
          >
            Kiểm tra tin đã gửi
          </LoadingButton>
          {(draftRejected || (command.failure && !command.uncertain)) && (
            <button
              type="button"
              className={styles.recoveryButton}
              onClick={() => {
                intent.current = null;
                setSaved(null);
                setDraftRejected(false);
                command.resetAfterRead();
                try {
                  sessionStorage.removeItem(key);
                } catch {
                  /* Keep editable memory draft. */
                }
              }}
            >
              Sửa bản gửi bị từ chối
            </button>
          )}
        </div>
      )}
      <ChatFiles
        key={conversationId}
        conversationId={conversationId}
        files={files}
        setFiles={setFiles}
        locked={!!saved || command.pending}
        onUploading={setUploading}
        compact
        inputId={fileInputId}
      />
      <div className={styles.composerRow}>
        <LoadingButton
          type="button"
          className={styles.attach}
          aria-label="Đính kèm tệp"
          title="Đính kèm tệp (tối đa 5 tệp, 15 MB/tệp)"
          disabled={
            !!saved || command.pending || uploading || files.length >= 5
          }
          onClick={() => document.getElementById(fileInputId)?.click()}
          loading={!!(command.pending || uploading)}
        >
          <ProductIcon name="paperclip" size={20} />
        </LoadingButton>
        <label className={styles.composerField}>
          <span className="sr-only">
            Tin nhắn (Enter để gửi, Shift + Enter để xuống dòng)
          </span>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Nhập tin nhắn…"
            title="Enter để gửi · Shift + Enter để xuống dòng"
            value={text}
            minLength={1}
            maxLength={2000}
            required={!files.length}
            disabled={!!saved || command.pending}
            onChange={(event) => {
              setText(event.target.value);
              syncTextareaHeight(event.target);
              if (notice) setNotice(undefined);
              if (command.error && !command.uncertain) {
                command.resetAfterRead();
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <LoadingButton
          type="submit"
          className={styles.send}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={
            command.pending ||
            checking ||
            uploading ||
            (!text.trim() && !files.length) ||
            (!saved && files.some((file) => file.state !== "READY"))
          }
          loading={!!(command.pending || checking || uploading)}
        >
          <ProductIcon name="send" size={18} />
        </LoadingButton>
      </div>
    </form>
  );
}
