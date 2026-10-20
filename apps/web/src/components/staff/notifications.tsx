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
import { StaffApiError } from "@/lib/staff/client";
import type { InboxNotification } from "@/lib/staff/types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { Pager, QueueState } from "./common";
export function NotificationsScreen() {
  const queue = useStaffList<InboxNotification>("notifications?limit=20");
  const { expire, api } = useStaffSession();
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = queue.items.filter((n) => filter === "ALL" || !n.readAt);
  return (
    <>
      <PageHeader
        title="Thông báo"
        desc="Thông báo của tài khoản đang đăng nhập."
        actions={
          <button
            type="button"
            className="btn"
            disabled={queue.loading || busy !== null}
            onClick={queue.reload}
          >
            Làm mới
          </button>
        }
      />
      <div className="toolbar">
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
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          {!items.length ? (
            <Empty
              title="Không có thông báo chưa đọc trong các mục đã tải"
              desc="Tải thêm để xem các thông báo trước đó."
            />
          ) : (
            <ul className="q-list">
              {items.map((n) => (
                <li className="staff-notification" key={n.id}>
                  <div className="stack">
                    <div className="row">
                      <strong>{n.title}</strong>
                      {!n.readAt && <Badge tone="brand">Chưa đọc</Badge>}
                    </div>
                    <p className="prose">{n.body}</p>
                    <span className="muted">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  {!n.readAt && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(n.id);
                        setError(null);
                        try {
                          await api<null>(`notifications/${n.id}/read`, {
                            method: "PATCH",
                            body: {},
                          });
                          await queue.reload();
                        } catch (e) {
                          if (e instanceof StaffApiError && e.status === 401)
                            expire();
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Không thể cập nhật thông báo.",
                          );
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === n.id ? "Đang lưu…" : "Đánh dấu đã đọc"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueueState>
        <Pager
          loading={queue.loading}
          hasMore={queue.page?.hasMore}
          more={queue.more}
        />
      </Card>
    </>
  );
}
