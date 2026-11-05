"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Conversation, Message, PathSummary, Proposal } from "../types";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { Feedback, More } from "../components/common";
import { ProfileAvatar } from "../components/profile-avatar";
import { ProductIcon } from "../components/product-icon";
import { findInPages } from "../api/find-page";
import { vietnamDateKey } from "@/lib/vietnam-time";
import { MessageComposer } from "./message-composer";
import { ChatMessage } from "./chat-message";
import { ChatAgreementDialog } from "./chat-agreement-dialog";
import styles from "./chat.module.css";

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "full",
});
function compareMessages(left: Message, right: Message) {
  const a = BigInt(left.sequence),
    b = BigInt(right.sequence);
  return a < b ? -1 : a > b ? 1 : 0;
}
export function ChatScreen({ id }: Readonly<{ id: string }>) {
  const cache = useQueryClient();
  const conversation = useUserResource<Conversation>("conversations/" + id),
    messages = useUserList<Message>(
      "conversations/" + id + "/messages?limit=30",
    );
  const { actor, request } = useUserSession(),
    router = useRouter();
  const proposal = useUserResource<Proposal>(
    conversation.data ? "proposals/" + conversation.data.proposalId : null,
  );
  const [creating, setCreating] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState<string>();
  const rows = useMemo(
      () => [...messages.items].sort(compareMessages),
      [messages.items],
    ),
    latest = rows.at(-1)?.id;
  useEffect(() => {
    if (!latest) return;
    let marked = false;
    let pending = false;
    const markRead = () => {
      if (document.visibilityState !== "visible" || marked || pending) return;
      pending = true;
      void request("conversations/" + id + "/read", {
        method: "POST",
        body: { messageId: latest },
      })
        .then(() => {
          marked = true;
          void cache.invalidateQueries({
            queryKey: ["learner", actor.userId, "conversations/inbox?limit=20"],
          });
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [id, latest, request, cache, actor.userId]);

  const partnerId = conversation.data
    ? conversation.data.participantAId === actor.userId
      ? conversation.data.participantBId
      : conversation.data.participantAId
    : null;
  const profile = useUserResource<{
    fullName: string;
    avatarUrl: string | null;
  }>(partnerId ? "profiles/" + partnerId : null);
  const partner = profile.data ?? {
    fullName: "Thành viên SkillHub",
    avatarUrl: null,
  };
  const timeline = useRef<HTMLDivElement>(null);
  const previous = useRef<{ first?: string; last?: string; height: number }>({
    height: 0,
  });
  const following = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  useLayoutEffect(() => {
    const element = timeline.current;
    if (!element) return;
    const first = rows[0]?.id,
      last = rows.at(-1)?.id;
    if (
      previous.current.last === last &&
      previous.current.first &&
      previous.current.first !== first
    ) {
      element.scrollTop += element.scrollHeight - previous.current.height;
    } else if (following.current) element.scrollTop = element.scrollHeight;
    previous.current = { first, last, height: element.scrollHeight };
  }, [rows, conversation.data?.id]);
  useEffect(() => {
    const element = timeline.current;
    if (!element) return;
    const resize = new ResizeObserver(() => {
      if (following.current) element.scrollTop = element.scrollHeight;
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [conversation.data?.id]);
  async function openAgreement() {
    if (opening) return;
    setOpening(true);
    setError(undefined);
    try {
      const path = await findInPages<PathSummary>(
        request,
        "learning-paths/mine?limit=100",
        (path) => path.conversationId === id,
      );
      if (path) router.push("/learn/paths/" + path.id);
      else setCreating(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể mở thỏa thuận.",
      );
    } finally {
      setOpening(false);
    }
  }
  return (
    <section className={styles.chat} aria-label="Cuộc trò chuyện">
      <Feedback
        loading={conversation.loading}
        error={conversation.error}
        reload={conversation.reload}
      />
      {conversation.data && (
        <>
          <header className={styles.header}>
            <Link
              className={styles.iconButton}
              href="/learn/messages"
              aria-label="Quay lại tin nhắn"
            >
              <span className={styles.backIcon}>
                <ProductIcon name="arrow" />
              </span>
            </Link>
            <Link
              className={styles.partner}
              href={"/learn/people/" + partnerId}
            >
              <ProfileAvatar
                fullName={partner.fullName}
                avatarUrl={partner.avatarUrl}
                className={styles.headerAvatar}
              />
              <span>
                <h2>{partner.fullName}</h2>
                <small>
                  {proposal.data?.learningRequestTitle?.trim() ||
                    (proposal.data?.sourceType === "DIRECT_SEARCH"
                      ? "Trao đổi trực tiếp"
                      : "Cùng trao đổi về yêu cầu học")}
                </small>
              </span>
            </Link>
            <button
              type="button"
              className={styles.agreement}
              disabled={opening}
              onClick={() => {
                void openAgreement();
              }}
            >
              <ProductIcon name="check" size={17} />
              {opening ? "Đang mở…" : "Thỏa thuận"}
            </button>
          </header>
          <Feedback error={error} />
          <Feedback error={proposal.error} reload={proposal.reload} />
          <div
            ref={timeline}
            className={styles.timeline}
            aria-label="Nội dung tin nhắn"
            tabIndex={0}
            onScroll={(event) => {
              const element = event.currentTarget;
              const bottom =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                100;
              following.current = bottom;
              setAtBottom(bottom);
            }}
          >
            <More
              cursor={messages.cursor}
              loading={messages.loading}
              onMore={() => {
                void messages.more();
              }}
            />
            <Feedback
              loading={messages.loading}
              error={messages.error}
              reload={messages.reload}
            />
            {rows.map((message, index) => {
              const previousMessage = rows[index - 1],
                next = rows[index + 1];
              const sameNext =
                !!next &&
                next.messageType !== "SYSTEM" &&
                next.senderId === message.senderId &&
                vietnamDateKey(next.sentAt) ===
                  vietnamDateKey(message.sentAt) &&
                Date.parse(next.sentAt) - Date.parse(message.sentAt) <
                  5 * 60_000;
              const dayStarts =
                !previousMessage ||
                vietnamDateKey(previousMessage.sentAt) !==
                  vietnamDateKey(message.sentAt);
              return (
                <div key={message.id}>
                  {dayStarts && (
                    <p className={styles.day}>
                      {dateFormat.format(new Date(message.sentAt))}
                    </p>
                  )}
                  <ChatMessage
                    message={message}
                    conversationId={id}
                    mine={message.senderId === actor.userId}
                    partner={partner}
                    showAvatar={!sameNext}
                    showTime={!sameNext}
                  />
                </div>
              );
            })}
            {!messages.loading && !messages.error && !rows.length && (
              <div className={styles.empty}>
                <ProductIcon name="chat" size={36} />
                <strong>Bắt đầu bằng một lời chào</strong>
                <p>Chia sẻ mục tiêu học và cùng tìm thời gian phù hợp.</p>
              </div>
            )}
          </div>
          {!atBottom && (
            <button
              type="button"
              className={styles.latest}
              onClick={() => {
                if (timeline.current)
                  timeline.current.scrollTop = timeline.current.scrollHeight;
                following.current = true;
                setAtBottom(true);
              }}
            >
              Xuống tin mới nhất ↓
            </button>
          )}
          <MessageComposer conversationId={id} />
          {creating && (
            <ChatAgreementDialog
              conversation={conversation.data}
              proposal={proposal.data}
              onClose={() => setCreating(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
