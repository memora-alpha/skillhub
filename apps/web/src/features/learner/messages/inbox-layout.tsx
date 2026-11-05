"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import type { Conversation } from "../types";
import { Empty, Feedback, More, PageHeading } from "../components/common";
import { ProfileName } from "../components/profile-name";
import styles from "./inbox.module.css";
type InboxGroup = {
  id: string;
  groupType: string;
  learningRequestId: string | null;
  conversationId: string | null;
  title: string | null;
  viewerRole: string;
  receivedProposalCount: number | null;
  sentProposalCount: number | null;
  conversationCount: number;
  hasUnread: boolean;
  latestMessage: {
    conversationId: string;
    senderId: string;
    preview: string;
    sentAt: string;
    messageType: string;
  } | null;
};
function proposalCountText(group: InboxGroup) {
  if (group.receivedProposalCount !== null)
    return group.receivedProposalCount + " đề nghị nhận";
  if (group.sentProposalCount !== null)
    return group.sentProposalCount + " đề nghị đã gửi";
  return "";
}
export function InboxLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const groups = useUserList<InboxGroup>("conversations/inbox?limit=20");
  const { actor } = useUserSession(),
    pathname = usePathname(),
    query = useUserList<Conversation>(
      "conversations?limit=20" +
        (requestId ? "&learningRequestId=" + requestId : ""),
    );
  const active = pathname !== "/learn/messages";
  return (
    <>
      <PageHeading
        eyebrow="TRAO ĐỔI VÀ KẾT NỐI"
        title="Tin nhắn"
        description="Cùng thống nhất mục tiêu và kế hoạch học qua từng cuộc trò chuyện."
      />
      <div className={"product-messages" + (active ? " has-conversation" : "")}>
        <aside
          className="product-conversations"
          aria-label="Danh sách cuộc trò chuyện"
        >
          <h2>Cuộc trò chuyện</h2>
          <details className={styles.groups} open>
            <summary>Nhóm theo bài nhu cầu học / kết nối trực tiếp</summary>
            <Feedback
              loading={groups.loading}
              error={groups.error}
              reload={groups.reload}
            />
            <button
              type="button"
              className="btn"
              aria-pressed={!requestId}
              onClick={() => setRequestId(null)}
            >
              Tất cả cuộc trò chuyện
            </button>
            {groups.items.map((group) => (
              <div
                key={group.id}
                className={
                  styles.group +
                  (group.hasUnread === true ? " " + styles.unread : "")
                }
              >
                {group.hasUnread === true && (
                  <strong className={styles.unreadLabel}>
                    ● Có tin nhắn chưa đọc
                  </strong>
                )}
                {group.groupType === "LEARNING_REQUEST" &&
                group.learningRequestId ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={requestId === group.learningRequestId}
                      onClick={() => setRequestId(group.learningRequestId)}
                    >
                      {group.title ?? "Nhu cầu học"} · {group.conversationCount}{" "}
                      cuộc trò chuyện
                    </button>
                    <p>
                      {proposalCountText(group)} ·{" "}
                      <Link
                        href={
                          "/learn/connections?learningRequestId=" +
                          group.learningRequestId +
                          "&direction=" +
                          (group.viewerRole === "OWNER" ? "received" : "sent")
                        }
                      >
                        Xem đề nghị của bài
                      </Link>
                    </p>
                  </>
                ) : (
                  group.conversationId && (
                    <Link href={"/learn/messages/" + group.conversationId}>
                      {group.title ?? "Kết nối trực tiếp"}
                    </Link>
                  )
                )}
                {group.latestMessage && (
                  <p className={styles.preview}>
                    <Link
                      href={
                        "/learn/messages/" + group.latestMessage.conversationId
                      }
                    >
                      {group.latestMessage.senderId === actor.userId
                        ? "Bạn: "
                        : ""}
                      {group.latestMessage.preview ||
                        (group.latestMessage.messageType === "FILE"
                          ? "Tệp đính kèm"
                          : "Tin nhắn hệ thống")}
                    </Link>
                    <br />
                    <time dateTime={group.latestMessage.sentAt}>
                      {new Date(group.latestMessage.sentAt).toLocaleString(
                        "vi-VN",
                      )}
                    </time>
                  </p>
                )}
              </div>
            ))}
            <More
              cursor={groups.cursor}
              loading={groups.loading}
              onMore={() => {
                void groups.more();
              }}
            />
          </details>
          <Feedback
            loading={query.loading}
            error={query.error}
            reload={query.reload}
          />
          {query.items.map((row) => (
            <Link
              key={row.id}
              href={"/learn/messages/" + row.id}
              aria-current={
                pathname === "/learn/messages/" + row.id ? "page" : undefined
              }
            >
              <span className="product-message-avatar" aria-hidden="true">
                S
              </span>
              <div>
                <strong>
                  <ProfileName
                    id={
                      row.participantAId === actor.userId
                        ? row.participantBId
                        : row.participantAId
                    }
                  />
                </strong>
                <small>
                  {row.learningRequestId
                    ? "Từ nhu cầu học"
                    : "Kết nối trực tiếp"}
                </small>
              </div>
            </Link>
          ))}
          {!query.loading && !query.error && !query.items.length && (
            <Empty>
              Chưa có cuộc trò chuyện. Đề nghị được chấp nhận sẽ tạo kết nối.
            </Empty>
          )}
          <More
            cursor={query.cursor}
            loading={query.loading}
            onMore={() => {
              void query.more();
            }}
          />
        </aside>
        <div className="product-message-content">{children}</div>
      </div>
    </>
  );
}
