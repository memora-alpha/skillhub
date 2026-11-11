"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ProductIcon } from "../components/product-icon";
import styles from "./chat.module.css";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
import { ChatFiles, type ChatUpload } from "./chat-files";
import { UserApiError } from "../api/client";
import { findContactInformation } from "@/lib/contact-policy";
import {
  parseChatDraft,
  parseEditingDraft,
  type ChatDraft as Draft,
} from "./chat-draft";
export function MessageComposer({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  const { actor, request, refresh } = useUserSession(),
    command = useUserCommand(true);
  const key = "skillhub-user-draft:" + actor.userId + ":" + conversationId;
  const fileInputId = useId();
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
    [notice, setNotice] = useState<string>(),
    [checking, setChecking] = useState(false);
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
  const contactIssue =
    findContactInformation(saved?.messageText ?? text) ??
    files.map((file) => findContactInformation(file.filename)).find(Boolean);
  const contactHintId = fileInputId + "-contact";
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
    setEditing(null);
    setText("");
    setFiles([]);
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(key + ":editing");
    } catch {
      /* Memory state remains authoritative for this screen. */
    }
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
        setNotice("Tin nhắn đã được chuyển.");
        refresh();
        return false;
      }
      return true;
    } catch (cause) {
      if (cause instanceof UserApiError && cause.status === 404) {
        const issue =
          findContactInformation(draft.messageText) ??
          draft.files
            ?.map((file) => findContactInformation(file.filename))
            .find(Boolean);
        if (issue) {
          intent.current = null;
          setSaved(null);
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* Keep the editable draft. */
          }
          setNotice(issue.message);
          return false;
        }
        return true;
      }
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Chưa kiểm tra được tin đang chờ.",
      );
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
    if (!intent.current && files.some((file) => file.state !== "CLEAN")) {
      setNotice(
        "Chờ tất cả tệp được kiểm tra sạch hoặc bỏ tệp chưa sẵn sàng trước khi gửi.",
      );
      return;
    }
    if (intent.current && !(await checkBeforeResend(intent.current))) return;
    if (contactIssue) {
      setNotice(contactIssue.message);
      return;
    }
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
      setNotice(
        "Trình duyệt không lưu được bản gửi đang chờ; giữ màn hình này để kiểm tra kết quả.",
      );
    }
    const result = await command.run(body.clientMessageId, () =>
      request<{ deliveryStatus: string }>(
        "conversations/" + conversationId + "/messages",
        {
          method: "POST",
          body: {
            clientMessageId: body.clientMessageId,
            messageText: body.messageText,
            attachmentFileIds: body.attachmentFileIds,
          },
        },
      ),
    );
    if (result?.data.deliveryStatus === "DELIVERED") {
      clear();
      setNotice("Tin nhắn đã được chuyển.");
    } else if (result)
      setNotice(
        "Máy chủ đang hoàn tất việc gửi. Kiểm tra trạng thái trước khi gửi nội dung khác.",
      );
  }
  let sendLabel = saved ? "Kiểm tra rồi gửi lại cùng yêu cầu" : "Gửi tin nhắn";
  if (checking) sendLabel = "Đang kiểm tra tin đã gửi…";
  if (command.pending) sendLabel = "Đang gửi…";
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
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
        <button
          type="button"
          className={styles.attach}
          aria-label="Đính kèm tệp"
          title="Tối đa 5 tệp, 15 MB/tệp"
          disabled={
            !!saved || command.pending || uploading || files.length >= 5
          }
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          <ProductIcon name="paperclip" size={22} />
        </button>
        <label className={styles.composerField}>
          <span className="sr-only">Tin nhắn</span>
          <textarea
            rows={1}
            placeholder="Nhập tin nhắn…"
            value={text}
            minLength={1}
            maxLength={2000}
            required={!files.length}
            aria-invalid={!!contactIssue}
            aria-describedby={contactIssue ? contactHintId : undefined}
            disabled={!!saved || command.pending}
            onChange={(event) => setText(event.target.value)}
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
        <button
          type="submit"
          className={styles.send}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={
            command.pending ||
            checking ||
            uploading ||
            (!saved && !!contactIssue) ||
            (!text.trim() && !files.length) ||
            (!saved && files.some((file) => file.state !== "CLEAN"))
          }
        >
          <ProductIcon name="send" size={20} />
        </button>
      </div>
      {contactIssue && (
        <output id={contactHintId} className="learner-error">
          {saved
            ? "Bản gửi cũ có thông tin liên hệ riêng. Kiểm tra kết quả trước khi sửa nội dung."
            : contactIssue.message}
        </output>
      )}
      <small className={styles.composerHint}>
        Enter để gửi · Shift + Enter để xuống dòng · Tối đa 15 MB/tệp
      </small>
      <div className="learner-actions">
        {saved && (
          <button
            className="btn"
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
                    setNotice("Tin nhắn đã được chuyển.");
                    refresh();
                  } else
                    setNotice(
                      "Tin nhắn vẫn đang xử lý. Bạn có thể kiểm tra lại.",
                    );
                })
                .catch((cause: unknown) =>
                  setNotice(
                    cause instanceof Error
                      ? cause.message
                      : "Chưa kiểm tra được kết quả.",
                  ),
                )
                .finally(() => setChecking(false));
            }}
          >
            Kiểm tra tin đã gửi
          </button>
        )}
      </div>
      {saved && command.failure && !command.uncertain && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            intent.current = null;
            setSaved(null);
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
      <CommandFeedback command={command} />
      {!checking && notice && (
        <p className="learner-notice">
          <output>{notice}</output>
        </p>
      )}
    </form>
  );
}
