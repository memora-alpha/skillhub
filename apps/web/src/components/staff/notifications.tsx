"use client";
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
          <button
            type="button"
            className="btn"
            disabled={queue.loading || !!queue.pendingId}
            onClick={reload}
          >
            {queue.loading ? "Đang tải…" : "Làm mới"}
          </button>
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
        {queue.live === "connecting" && "Đang kết nối cập nhật trực tiếp…"}
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
          <button
            type="button"
            className="btn btn-sm"
            disabled={queue.loading}
            onClick={reload}
          >
            Thử tải lại
          </button>
        </div>
      )}
      {queue.actionError && (
        <p className="staff-error" role="alert">
          {queue.actionError}
        </p>
      )}
      <Card flush className="ops-inbox">
        {!!items.length && <h2 className="admin-date-heading">Gần đây</h2>}
        {queue.loading && !queue.items.length && (
          <output className="staff-state">Đang tải thông báo…</output>
        )}
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
            {items.map((item) => (
              <li
                className="staff-notification"
                data-unread={!item.readAt}
                key={item.id}
              >
                <span className="ops-notification-icon" aria-hidden="true">
                  <Icon
                    name={
                      item.type.includes("report")
                        ? "inbox"
                        : item.type.includes("material")
                          ? "file"
                          : item.type.includes("learning-path")
                            ? "calendar"
                            : "bell"
                    }
                    size={20}
                  />
                </span>
                <div className="stack ops-notification-copy">
                  <div className="row">
                    <strong>{notificationCopy(item).title}</strong>
                    {!item.readAt && (
                      <span
                        className="admin-unread-dot"
                        role="img"
                        aria-label="Chưa đọc"
                      />
                    )}
                  </div>
                  <p className="prose">{notificationCopy(item).body}</p>
                  <time className="muted" dateTime={item.createdAt}>
                    {fmtDateTime(item.createdAt)}
                  </time>
                </div>
                {!item.readAt && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!!queue.pendingId}
                    onClick={() => {
                      void queue.inbox.markRead(item.id);
                    }}
                  >
                    {queue.pendingId === item.id
                      ? "Đang lưu…"
                      : "Đánh dấu đã đọc"}
                  </button>
                )}
                {item.readAt && (
                  <span className="admin-read-label">
                    <Icon name="check" size={15} />
                    Đã đọc
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <ListPagination query={pagination} />
      </Card>
    </section>
  );
}
