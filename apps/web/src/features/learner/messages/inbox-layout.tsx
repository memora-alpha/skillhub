"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { Conversation } from "../types";
import { Feedback, More } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { MemberIdentity } from "../components/member-identity";
import { formatVietnamTime } from "@/lib/vietnam-time";
import { RequestInbox } from "./request-inbox";
import { inboxGroupSummary, type InboxGroup } from "./inbox-types";
import styles from "./inbox.module.css";

export function InboxLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [selectedId, setSelectedId] = useState<string>();
  const groups = useUserList<InboxGroup>("conversations/inbox?limit=20");
  const conversations = useUserList<Conversation>("conversations?limit=20");
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname !== "/learn/messages";
  const selected = groups.items.find((group) => group.id === selectedId);
  return (
    <div className={styles.page} data-detail={active || !!selected}>
      <header className={styles.pageHeader}>
        <h1>Tin nhắn</h1>
        <Link href="/learn/connections">
          <ProductIcon name="users" size={17} />
          Đề nghị
        </Link>
      </header>
      <div className={styles.workspace}>
        <aside
          className={styles.sidebar}
          aria-label="Danh sách cuộc trò chuyện"
        >
          <div className={styles.sidebarHeading}>
            <h2>Hộp thư của bạn</h2>
            <span>Trao đổi và kết nối</span>
          </div>
          <Feedback
            loading={groups.loading}
            error={groups.error}
            reload={groups.reload}
          />
          <div className={styles.groupList}>
            {groups.items.map((group) => {
              if (
                group.groupType === "LEARNING_REQUEST" &&
                group.learningRequestId
              )
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={styles.groupCard}
                    data-unread={group.hasUnread}
                    aria-pressed={selectedId === group.id && !active}
                    onClick={() => {
                      setSelectedId(group.id);
                      if (active) router.push("/learn/messages");
                    }}
                  >
                    <span className={styles.groupIcon}>
                      <ProductIcon name="book" size={21} />
                    </span>
                    <span className={styles.groupText}>
                      <strong>{group.title?.trim() || "Yêu cầu học"}</strong>
                      <small>{inboxGroupSummary(group)}</small>
                    </span>
                    {group.hasUnread && (
                      <span
                        className={styles.dot}
                        aria-label="Có tin nhắn chưa đọc"
                      />
                    )}
                    <ProductIcon name="chevron" size={15} />
                  </button>
                );
              if (group.conversationId)
                return (
                  <DirectConversation
                    key={group.id}
                    group={group}
                    conversation={conversations.items.find(
                      (item) => item.id === group.conversationId,
                    )}
                    loading={conversations.loading}
                    active={pathname.endsWith("/" + group.conversationId)}
                    onOpen={() => setSelectedId(undefined)}
                  />
                );
              return null;
            })}
          </div>
          {!groups.loading && !groups.error && !groups.items.length && (
            <div className={styles.empty}>
              <ProductIcon name="chat" size={34} />
              <strong>Chưa có tin nhắn</strong>
              <p>
                Đề nghị nhận được và các cuộc trò chuyện sẽ xuất hiện tại đây.
              </p>
              <Link href="/learn/connections">Xem đề nghị</Link>
            </div>
          )}
          <More
            cursor={groups.cursor}
            loading={groups.loading}
            onMore={() => {
              void groups.more();
            }}
          />
        </aside>
        <div className={styles.main}>
          {!active && selected ? (
            <RequestInbox
              key={selected.id}
              group={selected}
              onBack={() => setSelectedId(undefined)}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

function DirectConversation({
  group,
  conversation,
  loading,
  active,
  onOpen,
}: Readonly<{
  group: InboxGroup;
  conversation?: Conversation;
  loading: boolean;
  active: boolean;
  onOpen: () => void;
}>) {
  const { actor } = useUserSession();
  const detail = useUserResource<Conversation>(
    !conversation && !loading ? "conversations/" + group.conversationId : null,
  );
  const row = conversation ?? detail.data;
  let partnerId: string | null = null;
  if (row)
    partnerId =
      row.participantAId === actor.userId
        ? row.participantBId
        : row.participantAId;
  const last = group.latestMessage;
  return (
    <Link
      className={styles.direct}
      href={"/learn/messages/" + group.conversationId}
      aria-current={active ? "page" : undefined}
      data-unread={group.hasUnread}
      onClick={onOpen}
    >
      {partnerId ? (
        <MemberIdentity
          id={partnerId}
          description={group.title || "Trao đổi trực tiếp"}
        />
      ) : (
        <strong>{group.title || "Cuộc trò chuyện"}</strong>
      )}
      {last && (
        <span className={styles.preview}>
          <span>
            {last.senderId === actor.userId ? "Bạn: " : ""}
            {last.preview ||
              (last.messageType === "FILE"
                ? "Tệp đính kèm"
                : "Cập nhật cuộc trò chuyện")}
          </span>
          <time dateTime={last.sentAt}>{formatVietnamTime(last.sentAt)}</time>
        </span>
      )}
      {group.hasUnread && (
        <span className={styles.unreadLabel}>Có tin nhắn chưa đọc</span>
      )}
    </Link>
  );
}
