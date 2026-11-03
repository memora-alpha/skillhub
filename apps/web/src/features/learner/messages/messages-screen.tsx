"use client";
import Link from "next/link";
import type { Conversation } from "../types";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
} from "../components/common";
import { ProfileName } from "../components/profile-name";
export function MessagesScreen() {
  const query = useUserList<Conversation>("conversations?limit=10"),
    { actor } = useUserSession();
  return (
    <>
      <PageHeading
        title="Tin nhắn"
        description="Trao đổi mục tiêu, thỏa thuận Credit và chọn lịch học cùng đối tác."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-stack">
        {query.items.map((conversation) => (
          <Panel key={conversation.id}>
            <h2>
              <ProfileName
                id={
                  conversation.participantAId === actor.userId
                    ? conversation.participantBId
                    : conversation.participantAId
                }
              />
            </h2>
            <p>
              Cuộc trao đổi của bạn ·{" "}
              {conversation.learningRequestId
                ? "Từ bài đăng tìm người học"
                : "Kết nối trực tiếp"}
            </p>
            <Link
              className="btn btn-primary"
              href={"/learn/messages/" + conversation.id}
            >
              Mở cuộc trao đổi
            </Link>
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>
          Các cuộc trao đổi xuất hiện khi một đề xuất được chấp nhận.
        </Empty>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </>
  );
}
