"use client";
import { LoadingButton } from "@/components/loading-button";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  contactPolicyMessage,
  detectContactInformation,
} from "@/lib/chat/contact-policy";
import {
  contentPolicyMessage,
  detectInappropriateText,
} from "@/lib/chat/content-policy";
import type { useRoomChat } from "./use-room-chat";
import { roomChatTextLimit, type RoomChatMessage } from "./ephemeral-chat";
import { formatRoomChatBadge, type RoomChatMode } from "./room-chat-unread";
import { RoomIcon } from "./room-icon";
import { RoomAvatar } from "./room-avatar";
import type { RoomPerson } from "./room-profiles";
import styles from "./room-chat.module.css";

export function RoomChatToast({
  message,
  unreadCount,
  peer,
  onOpen,
  onDismiss,
}: Readonly<{
  message: RoomChatMessage;
  unreadCount: number;
  peer: RoomPerson;
  onOpen: () => void;
  onDismiss: () => void;
}>) {
  const countBadge =
    unreadCount > 1
      ? `${formatRoomChatBadge(unreadCount)} mới`
      : "Tin nhắn mới";
  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <button
        type="button"
        className={styles.toastOpen}
        onClick={onOpen}
        aria-label={`Mở chat phiên học — tin nhắn mới từ ${peer.name}: ${message.text}`}
      >
        <RoomAvatar
          name={peer.name}
          avatarUrl={peer.avatarUrl}
          className={styles.headerAvatar}
        />
        <span className={styles.toastContent}>
          <span className={styles.toastMeta}>
            <strong>{peer.name}</strong>
            <span className={styles.toastCount}>{countBadge}</span>
          </span>
          <span className={styles.toastText}>{message.text}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.toastDismiss}
        onClick={onDismiss}
        title="Ẩn thông báo tin nhắn"
        aria-label="Ẩn thông báo tin nhắn"
      >
        <RoomIcon name="close" />
      </button>
    </div>
  );
}

export function RoomChat({
  chat,
  close,
  open,
  mode,
  unreadCount,
  latestUnread,
  onToggleMinimize,
  onToggleMaximize,
  peer,
  self,
}: Readonly<{
  chat: ReturnType<typeof useRoomChat>;
  close: () => void;
  open: boolean;
  mode: RoomChatMode;
  unreadCount: number;
  latestUnread?: RoomChatMessage;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  peer: RoomPerson;
  self: RoomPerson;
}>) {
  const [draft, setDraft] = useState("");
  const [policyError, setPolicyError] = useState<string>();
  const log = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const windowRef = useRef<HTMLElement>(null);
  const previousMode = useRef<RoomChatMode>(mode);
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
  const badge = minimized ? formatRoomChatBadge(unreadCount) : undefined;
  const headerSubtitle =
    minimized && latestUnread
      ? `${peer.name}: ${latestUnread.text}`
      : peer.name;
  useEffect(() => {
    if (open && !minimized && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [chat.messages, open, minimized]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (detectContactInformation(trimmed)) {
      setPolicyError(contactPolicyMessage);
      return;
    }
    if (detectInappropriateText(trimmed)) {
      setPolicyError(contentPolicyMessage);
      return;
    }
    setPolicyError(undefined);
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
      data-unread={badge ? "true" : undefined}
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
            {badge && (
              <span
                className={styles.badge}
                aria-label={unreadCount + " tin nhắn mới"}
              >
                {badge}
              </span>
            )}
          </h2>
          <span className={styles.peerName} title={headerSubtitle}>
            {headerSubtitle}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-controls={bodyId}
            aria-expanded={!minimized}
            title={minimized ? "Mở lại chat" : "Thu nhỏ chat"}
            aria-label={minimized ? "Mở lại chat" : "Thu nhỏ chat"}
          >
            <RoomIcon name={minimized ? "chevronUp" : "minimize"} />
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
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
        {(policyError || chat.error) && (
          <p className={styles.error} role="alert">
            {policyError ?? chat.error}
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
            onChange={(event) => {
              setDraft(event.target.value);
              if (policyError) setPolicyError(undefined);
            }}
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
            <LoadingButton
              type="submit"
              disabled={!chat.ready || chat.pending || !draft.trim()}
              loading={!!chat.pending}
            >
              {chat.pending ? "Đang gửi…" : "Gửi"}
            </LoadingButton>
          </div>
        </form>
      </div>
    </aside>
  );
}
