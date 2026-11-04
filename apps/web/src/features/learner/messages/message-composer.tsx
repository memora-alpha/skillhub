"use client";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
type Draft = {
  clientMessageId: string;
  messageText: string;
  attachmentFileIds: string[];
};
export function MessageComposer({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  const { actor, request, refresh } = useUserSession(),
    command = useUserCommand(true);
  const key = "skillhub-user-draft:" + actor.userId + ":" + conversationId;
  const [saved, setSaved] = useState<Draft | null>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(key) ?? "null",
      ) as Draft | null;
      return value &&
        typeof value.messageText === "string" &&
        /^[0-9a-f-]{36}$/i.test(value.clientMessageId)
        ? { ...value, attachmentFileIds: [] }
        : null;
    } catch {
      return null;
    }
  });
  const intent = useRef(saved),
    [text, setText] = useState(saved?.messageText ?? ""),
    [notice, setNotice] = useState<string>(),
    [checking, setChecking] = useState(false);
  function clear() {
    intent.current = null;
    setSaved(null);
    setText("");
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Memory state remains authoritative for this screen. */
    }
  }
  async function send() {
    const messageText = text.trim();
    if (!messageText || command.pending) return;
    const body = intent.current ?? {
      clientMessageId: crypto.randomUUID(),
      messageText,
      attachmentFileIds: [],
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
        { method: "POST", body },
      ),
    );
    if (result?.data.deliveryStatus === "DELIVERED") {
      clear();
      setNotice(undefined);
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
          required
          disabled={!!saved || command.pending}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="learner-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={command.pending || !text.trim()}
        >
          {saved ? "Gửi lại cùng yêu cầu" : "Gửi tin nhắn"}
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
      <CommandFeedback command={command} />
      {!checking && notice && (
        <p className="learner-notice">
          <output>{notice}</output>
        </p>
      )}
    </form>
  );
}
