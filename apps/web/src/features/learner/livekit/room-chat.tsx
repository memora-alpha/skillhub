"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { useRoomChat } from "./use-room-chat";
import { roomChatTextLimit } from "./ephemeral-chat";
import { RoomIcon } from "./room-icon";
import { RoomAvatar } from "./room-avatar";
import type { RoomPerson } from "./room-profiles";
import styles from "./room-chat.module.css";

type WindowMode = "floating" | "minimized" | "maximized";

export function RoomChat({
  chat,
  close,
  open,
  peer,
  self,
}: {
  chat: ReturnType<typeof useRoomChat>;
  close: () => void;
  open: boolean;
  peer: RoomPerson;
  self: RoomPerson;
}) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<WindowMode>("floating");
  const [restoreMode, setRestoreMode] = useState<"floating" | "maximized">(
    "floating",
  );
  const [lastReadId, setLastReadId] = useState<string>();
  const log = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const minimized = mode === "minimized";
  const seen = chat.messages.findIndex((message) => message.id === lastReadId);
  const unread = minimized
    ? chat.messages.slice(seen + 1).filter((message) => !message.own).length
    : 0;
  useEffect(() => {
    if (open && !minimized && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [chat.messages, open, minimized]);
  function toggleMinimize() {
    if (minimized) setMode(restoreMode);
    else {
      setLastReadId(chat.messages.at(-1)?.id);
      setRestoreMode(mode);
      setMode("minimized");
    }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft;
    if (await chat.send(text))
      setDraft((value) => (value === text ? "" : value));
  }
  return (
    <aside
      className={styles.chat}
      hidden={!open}
      data-mode={mode}
      aria-label={"Chat phiên học với " + peer.name}
    >
      <header className={styles.header}>
        <RoomAvatar
          name={peer.name}
          avatarUrl={peer.avatarUrl}
          className={styles.headerAvatar}
        />
        <div className={styles.heading}>
          <h2>
            Chat phiên học{" "}
            {unread > 0 && (
              <span
                className={styles.badge}
                aria-label={unread + " tin nhắn mới"}
              >
                {unread}
              </span>
            )}
          </h2>
          <span className={styles.peerName} title={peer.name}>
            {peer.name}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={toggleMinimize}
            aria-controls={bodyId}
            aria-expanded={!minimized}
            title={minimized ? "Mở lại chat" : "Thu nhỏ chat"}
            aria-label={minimized ? "Mở lại chat" : "Thu nhỏ chat"}
          >
            <RoomIcon name={minimized ? "chevronUp" : "minimize"} />
          </button>
          <button
            type="button"
            onClick={() =>
              setMode(mode === "maximized" ? "floating" : "maximized")
            }
            aria-pressed={mode === "maximized"}
            title={
              mode === "maximized"
                ? "Khôi phục kích thước chat"
                : "Phóng to chat"
            }
            aria-label={
              mode === "maximized"
                ? "Khôi phục kích thước chat"
                : "Phóng to chat"
            }
          >
            <RoomIcon
              name={mode === "maximized" ? "restoreWindow" : "maximize"}
            />
          </button>
          <button
            type="button"
            onClick={close}
            title="Đóng chat"
            aria-label="Đóng chat"
          >
            <RoomIcon name="close" />
          </button>
        </div>
      </header>
      <div id={bodyId} className={styles.body} hidden={minimized}>
        <p className={styles.notice}>
          Tin nhắn chỉ ở phiên này, mất khi rời phòng. Người vào sau không xem
          được tin trước đó.
        </p>
        <div className={styles.status} data-ready={chat.ready} role="status">
          <i />
          {chat.ready
            ? "Trực tiếp"
            : chat.status === "not-permitted"
              ? "Chat chưa được cấp quyền"
              : "Đang chờ kết nối"}
        </div>
        <div
          ref={log}
          className={styles.log}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Tin nhắn phiên học"
        >
          {!chat.messages.length && (
            <p className={styles.empty}>
              Gửi lời chào hoặc câu hỏi cho {peer.name}.
            </p>
          )}
          {chat.messages.map((message) => {
            const person = message.own ? self : peer;
            return (
              <div
                key={message.id}
                data-own={message.own}
                className={styles.message}
              >
                <div className={styles.messageAuthor}>
                  <RoomAvatar
                    name={person.name}
                    avatarUrl={person.avatarUrl}
                    className={styles.messageAvatar}
                  />
                  <strong>
                    {person.name}
                    {message.own ? " (Bạn)" : ""}
                  </strong>
                </div>
                <p>{message.text}</p>
              </div>
            );
          })}
        </div>
        {!chat.ready && (
          <p className={styles.feedback} role="status">
            {chat.statusMessage}
          </p>
        )}
        {chat.error && (
          <p className={styles.error} role="alert">
            {chat.error}
          </p>
        )}
        <form
          onSubmit={(event) => {
            void send(event);
          }}
        >
          <label htmlFor={bodyId + "-message"}>Tin nhắn</label>
          <textarea
            id={bodyId + "-message"}
            value={draft}
            rows={2}
            maxLength={roomChatTextLimit}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!chat.ready || chat.pending}
            placeholder={"Nhắn cho " + peer.name + "…"}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (chat.ready && !chat.pending && draft.trim())
                  event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className={styles.composerActions}>
            <span>Enter để gửi · Shift + Enter xuống dòng</span>
            <button
              type="submit"
              disabled={!chat.ready || chat.pending || !draft.trim()}
            >
              {chat.pending ? "Đang gửi…" : "Gửi"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
