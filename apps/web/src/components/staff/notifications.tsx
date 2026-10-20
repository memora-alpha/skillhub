"use client";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Segmented,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import { useNotificationInbox } from "./notification-session";
import { Pager } from "./common";

export function NotificationsScreen() {
  const queue = useNotificationInbox();
  const [filter, setFilter] = useState("ALL");
  const items = queue.items.filter((item) => filter === "ALL" || !item.readAt);
  const reload = () => {
    void queue.inbox.reload().catch(() => {});
  };
  return (
    <>
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
      <div className="toolbar">
        <Segmented
          label="Lọc thông báo đã tải"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "ALL", label: "Tất cả" },
            { id: "UNREAD", label: "Chưa đọc" },
          ]}
        />
      </div>
      <div className="staff-notification-status" role="status">
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
      </div>
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
      <Card flush>
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
            title="Không có thông báo chưa đọc trong các mục đã tải"
            desc={
              queue.page?.hasMore
                ? "Tải thêm để xem các thông báo trước đó."
                : "Bạn đã đọc các thông báo đã tải."
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
                <div className="stack">
                  <div className="row">
                    <strong>{item.title}</strong>
                    {!item.readAt && <Badge tone="brand">Chưa đọc</Badge>}
                  </div>
                  <p className="prose">{item.body}</p>
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
              </li>
            ))}
          </ul>
        )}
        <Pager
          loading={queue.loading}
          hasMore={queue.page?.hasMore}
          more={() => {
            void queue.inbox.more().catch(() => {});
          }}
        />
      </Card>
    </>
  );
}
