"use client";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
import { ChatFiles, type ChatUpload } from "./chat-files";
import { UserApiError } from "../api/client";
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
  const [saved, setSaved] = useState<Draft | null>(() => {
    try {
      return parseChatDraft(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  });
  const [editing] = useState(() => {
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
    setText("");
    setFiles([]);
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(key + ":editing");
    } catch {
      /* Memory state remains authoritative for this screen. */
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
    if (intent.current) {
      setChecking(true);
      try {
        const receipt = await request<{ deliveryStatus: string }>(
          "conversations/" +
            conversationId +
            "/message-deliveries/" +
            intent.current.clientMessageId,
        );
        if (receipt.data.deliveryStatus === "DELIVERED") {
          clear();
          setNotice("Tin nhắn đã được chuyển.");
          refresh();
          return;
        }
      } catch (cause) {
        if (!(cause instanceof UserApiError) || cause.status !== 404) {
          setNotice(
            cause instanceof Error
              ? cause.message
              : "Chưa kiểm tra được tin đang chờ.",
          );
          return;
        }
      } finally {
        setChecking(false);
      }
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
  return (
    <form
      className="learner-form"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label>
        <span>Tin nhắn</span>
        <textarea
          rows={3}
          value={text}
          minLength={1}
          maxLength={2000}
          required={!files.length}
          disabled={!!saved || command.pending}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <ChatFiles
        key={conversationId}
        conversationId={conversationId}
        files={files}
        setFiles={setFiles}
        locked={!!saved || command.pending}
        onUploading={setUploading}
      />
      <div className="learner-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            command.pending ||
            checking ||
            uploading ||
            (!text.trim() && !files.length) ||
            (!saved && files.some((file) => file.state !== "CLEAN"))
          }
        >
          {command.pending
            ? "Đang gửi…"
            : checking
              ? "Đang kiểm tra tin đã gửi…"
              : saved
                ? "Kiểm tra rồi gửi lại cùng yêu cầu"
                : "Gửi tin nhắn"}
        </button>
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
