"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useState } from "react";
import { Icon } from "@/components/console/icon";
import { notificationCopy } from "@/lib/i18n/system-copy";
import { Card, Empty, PageHeader, Segmented } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { useNotificationInbox } from "./notification-session";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffSession } from "./session";

export function NotificationsScreen() {
  const queue = useNotificationInbox();
  const { actor } = useStaffSession();
  const [filter, setFilter] = useState("ALL");
  const pagination = useListPages({
    scope: `${actor?.userId}:notifications:${filter}`,
    chunks: splitPages(queue.items),
    loading: queue.loading,
    error: queue.error ?? undefined,
    hasMore: !!queue.page?.hasMore,
    more: () => queue.inbox.more().catch(() => {}),
    reload: () => queue.inbox.reload().catch(() => {}),
  });
  const items = pagination.items.filter(
    (item) => filter === "ALL" || !item.readAt,
  );
  const reload = () => {
    void pagination.reload();
  };
  return (
    <section className="staff-notifications">
      <PageHeader
        title="Thông báo"
        desc="Thông báo của tài khoản đang đăng nhập, mới nhất trước."
        actions={
          <LoadingButton
            type="button"
            className="btn"
            disabled={queue.loading || !!queue.pendingId}
            onClick={reload}
            loading={!!(queue.loading || !!queue.pendingId)}
          >
            {queue.loading ? "Đang tải…" : "Làm mới"}
          </LoadingButton>
        }
      />
      <div className="ops-tabbar">
        <Segmented
          label="Lọc thông báo"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "ALL", label: "Tất cả" },
            { id: "UNREAD", label: "Chưa đọc" },
          ]}
        />
      </div>
      <output
        className="staff-notification-status ops-notification-connection"
        data-state={queue.live}
      >
        {queue.live === "connected" && "Đang nhận cập nhật trực tiếp"}
        {queue.live === "connecting" && (
          <LoadingSkeleton
            variant="inline"
            label="Đang kết nối cập nhật trực tiếp"
          />
        )}
        {queue.live === "paused" && "Tạm dừng cập nhật khi tab ở nền."}
        {queue.live === "unavailable" && (
          <>
            <span>
              Cập nhật trực tiếp tạm gián đoạn. Bạn vẫn có thể làm mới danh
              sách.
            </span>
            <button type="button" className="btn btn-sm" onClick={queue.retry}>
              Kết nối lại
            </button>
          </>
        )}
      </output>
      {queue.error && (
        <div className="staff-notification-status">
          <p className="staff-error" role="alert">
            {queue.error}
          </p>
          <LoadingButton
            type="button"
            className="btn btn-sm"
            disabled={queue.loading}
            onClick={reload}
            loading={!!queue.loading}
          >
            Thử tải lại
          </LoadingButton>
        </div>
      )}
      {queue.actionError && (
        <p className="staff-error" role="alert">
          {queue.actionError}
        </p>
      )}
      <Card flush className="ops-inbox">
        {!!items.length && <h2 className="admin-date-heading">Gần đây</h2>}
        {queue.loading && !queue.items.length && <LoadingSkeleton />}
        {!queue.loading && !queue.error && !queue.items.length && (
          <Empty
            title="Chưa có thông báo"
            desc="Thông báo mới sẽ xuất hiện tại đây khi có cập nhật."
          />
        )}
        {!!queue.items.length && !items.length && (
          <Empty
            title="Không có thông báo chưa đọc trên trang này"
            desc={
              queue.page?.hasMore
                ? "Chuyển trang để xem các thông báo trước đó."
                : "Chọn trang khác hoặc xem tất cả thông báo."
            }
          />
        )}
        {!!items.length && (
          <ul
            className="q-list"
            aria-label="Danh sách thông báo"
            aria-busy={queue.loading}
          >
            {items.map((item) => {
              function notificationIcon() {
                if (item.type.includes("report")) {
                  return "inbox" as const;
                }
                if (item.type.includes("material")) {
                  return "file" as const;
                }
                if (item.type.includes("learning-path")) {
                  return "calendar" as const;
                }
                return "bell" as const;
              }
              return (
                <li
                  className="staff-notification"
                  data-unread={!item.readAt}
                  key={item.id}
                >
                  <span className="ops-notification-icon" aria-hidden="true">
                    <Icon name={notificationIcon()} size={20} />
                  </span>
                  <div className="stack ops-notification-copy">
                    <div className="row">
                      <strong>{notificationCopy(item).title}</strong>
                      {!item.readAt && (
                        <>
                          <span
                            className="admin-unread-dot"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Chưa đọc</span>
                        </>
                      )}
                    </div>
                    <p className="prose">{notificationCopy(item).body}</p>
                    <time className="muted" dateTime={item.createdAt}>
                      {fmtDateTime(item.createdAt)}
                    </time>
                  </div>
                  {!item.readAt && (
                    <LoadingButton
                      type="button"
                      className="btn btn-sm"
                      disabled={!!queue.pendingId}
                      onClick={() => {
                        void queue.inbox.markRead(item.id);
                      }}
                      loading={queue.pendingId === item.id}
                    >
                      {queue.pendingId === item.id
                        ? "Đang lưu…"
                        : "Đánh dấu đã đọc"}
                    </LoadingButton>
                  )}
                  {item.readAt && (
                    <span className="admin-read-label">
                      <Icon name="check" size={15} />
                      Đã đọc
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ListPagination query={pagination} />
      </Card>
    </section>
  );
}
