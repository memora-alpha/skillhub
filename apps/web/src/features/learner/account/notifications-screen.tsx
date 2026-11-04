"use client";
import Link from "next/link";
import { useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { useUnreadNotifications } from "../hooks/use-unread-notifications";
import { useUserSession } from "../auth/session";
import {
  CommandFeedback,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { notificationDestination } from "./view-policy";
import type { InboxNotification } from "./account-types";
export function NotificationsScreen() {
  const query = useUserList<InboxNotification>("notifications?limit=20"),
    command = useUserCommand(),
    { request } = useUserSession();
  const unread = useUnreadNotifications();
  let summary = "Đang tải số thông báo chưa đọc…";
  if (unread.error)
    summary =
      "Chưa tải được số thông báo chưa đọc. Bạn có thể làm mới để thử lại.";
  else if (unread.count !== undefined) {
    if (unread.count === 0) summary = "Bạn đã đọc tất cả thông báo.";
    else if (unread.count > 99) summary = "Bạn có hơn 99 thông báo chưa đọc.";
    else summary = `Bạn có ${unread.count} thông báo chưa đọc.`;
  }
  return (
    <>
      <PageHeading
        eyebrow="CẬP NHẬT DÀNH CHO BẠN"
        title="Thông báo"
        description="Theo dõi những thay đổi trong học tập và kết nối."
        action={
          <button
            type="button"
            className="btn"
            disabled={query.loading || unread.refreshing}
            onClick={() => {
              query.reload();
              void unread.reload();
            }}
          >
            Làm mới thông báo
          </button>
        }
      />
      <p className="learner-notice" role="status">
        {summary}
      </p>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <CommandFeedback command={command} />
      <div className="learner-stack">
        {query.items.map((item) => {
          const href = notificationDestination(item.payload);
          return (
            <Panel
              className={
                "product-notification" + (!item.readAt ? " unread" : "")
              }
              key={item.id}
            >
              <ProductIcon name="notification" />
              <div>
                <h2>{item.title}</h2>
                <p className="learner-prose">{item.body}</p>
                <time dateTime={item.createdAt}>
                  {formatTime(item.createdAt)}
                </time>
                {href && (
                  <p>
                    <Link className="learner-card-link" href={href}>
                      Xem chi tiết →
                    </Link>
                  </p>
                )}
              </div>
              {!item.readAt && (
                <button
                  className="btn"
                  disabled={command.pending || command.uncertain}
                  onClick={() => {
                    void command
                      .run("read:" + item.id, () =>
                        request("notifications/" + item.id + "/read", {
                          method: "PATCH",
                        }),
                      )
                      .then((result) => {
                        if (result) query.reload();
                      });
                  }}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </Panel>
          );
        })}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>Bạn chưa có thông báo.</Empty>
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
