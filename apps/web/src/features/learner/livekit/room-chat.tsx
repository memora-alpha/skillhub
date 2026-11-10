"use client";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { useRoomChat } from "./use-room-chat";
import { roomChatTextLimit } from "./ephemeral-chat";
import { RoomIcon } from "./room-icon";
import { findContactInformation } from "@/lib/contact-policy";
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
}: Readonly<{
  chat: ReturnType<typeof useRoomChat>;
  close: () => void;
  open: boolean;
  peer: RoomPerson;
  self: RoomPerson;
}>) {
  const [draft, setDraft] = useState("");
  const contactIssue = findContactInformation(draft);
  const [mode, setMode] = useState<WindowMode>("floating");
  const [restoreMode, setRestoreMode] = useState<"floating" | "maximized">(
    "floating",
  );
  const [lastReadId, setLastReadId] = useState<string>();
  const log = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const windowRef = useRef<HTMLElement>(null);
  const previousMode = useRef<WindowMode>("floating");
  const floatingSize = useRef({ width: "", height: "" });
  useLayoutEffect(() => {
    const style = windowRef.current?.style;
    if (!style) return;
    if (previousMode.current === "floating" && mode !== "floating") {
      floatingSize.current = { width: style.width, height: style.height };
      style.removeProperty("width");
      style.removeProperty("height");
    } else if (mode === "floating" && previousMode.current !== "floating") {
      style.width = floatingSize.current.width;
      style.height = floatingSize.current.height;
    }
    previousMode.current = mode;
  }, [mode]);
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
  let connectionLabel: string;
  if (chat.ready) connectionLabel = "Trực tiếp";
  else if (chat.status === "not-permitted")
    connectionLabel = "Chat chưa được cấp quyền";
  else connectionLabel = "Đang chờ kết nối";
  return (
    <aside
      ref={windowRef}
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
        <output className={styles.status} data-ready={chat.ready}>
          <i />
          {connectionLabel}
        </output>
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
          <p className={styles.feedback}>
            <output>{chat.statusMessage}</output>
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
            aria-invalid={!!contactIssue}
            aria-describedby={contactIssue ? bodyId + "-contact" : undefined}
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
          {contactIssue && (
            <p id={bodyId + "-contact"} role="status" className={styles.error}>
              {contactIssue.message}
            </p>
          )}
          <div className={styles.composerActions}>
            <span>Enter để gửi · Shift + Enter xuống dòng</span>
            <button
              type="submit"
              disabled={
                !chat.ready || chat.pending || !draft.trim() || !!contactIssue
              }
            >
              {chat.pending ? "Đang gửi…" : "Gửi"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
