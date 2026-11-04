"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import type { Conversation } from "../types";
import { Empty, Feedback, More, PageHeading } from "../components/common";
import { ProfileName } from "../components/profile-name";
export function InboxLayout({ children }: { children: ReactNode }) {
  const { actor } = useUserSession(),
    pathname = usePathname(),
    query = useUserList<Conversation>("conversations?limit=20");
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
