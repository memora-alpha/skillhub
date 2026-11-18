"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ListPagination } from "@/components/pagination/list-pagination";
import { notificationCopy } from "@/lib/i18n/system-copy";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useUnreadNotifications } from "../hooks/use-unread-notifications";
import { useUserSession } from "../auth/session";
import { Empty, Feedback, PageHeading, formatTime } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { notificationDestination } from "./view-policy";
import type { InboxNotification } from "./account-types";
import { WebPushSettings } from "../notifications/web-push-settings";
import { NotificationPreferences } from "../notifications/notification-preferences";
import { markAllNotificationsRead } from "../notifications/mark-notifications-read";
import styles from "./notifications-screen.module.css";

export function NotificationsScreen() {
  const { actor } = useUserSession();
  return <NotificationInbox key={actor.userId} />;
}

function NotificationInbox() {
  const { actor, request } = useUserSession();
  const cache = useQueryClient();
  const query = useUserPagedList<InboxNotification>("notifications?limit=20");
  const unread = useUnreadNotifications();
  const operation = useRef<AbortController | null>(null);
  const [reading, setReading] = useState<string>();
  const [readIds, setReadIds] = useState(new Set<string>());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string>();
  const [settings, setSettings] = useState(false);
  useEffect(() => () => operation.current?.abort(), []);
  const busy = reading !== undefined;

  async function markRead(id?: string) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setReading(id ?? "all");
    setNotice("");
    setError(undefined);
    try {
      const mark = (notificationId: string, signal: AbortSignal) =>
        request(`notifications/${notificationId}/read`, {
          method: "PATCH",
          signal,
        });
      const result = id
        ? (await mark(id, controller.signal), { updated: [id], complete: true })
        : await markAllNotificationsRead(
            (path, signal) => request(path, { signal }),
            mark,
            controller.signal,
          );
      if (controller.signal.aborted) return;
      setReadIds((previous) => new Set([...previous, ...result.updated]));
      if (result.complete)
        setNotice(
          id
            ? "Đã đánh dấu đã đọc."
            : "Đã đánh dấu các thông báo hiện có là đã đọc.",
        );
      else
        setError(
          "Một số thông báo chưa được cập nhật. Bạn có thể bấm Đọc tất cả để thử lại.",
        );
    } catch {
      if (!controller.signal.aborted)
        setError("Chưa thể đánh dấu đã đọc. Vui lòng thử lại.");
    } finally {
      if (!controller.signal.aborted) {
        await cache.invalidateQueries({
          predicate: (entry) =>
            entry.queryKey[0] === "learner" &&
            entry.queryKey[1] === actor.userId &&
            typeof entry.queryKey[2] === "string" &&
            /^notifications(?:\?|\/|$)/.test(entry.queryKey[2]),
        });
        if (!controller.signal.aborted) {
          operation.current = null;
          setReading(undefined);
        }
      }
    }
  }

  let summary = "Cập nhật mới dành cho bạn.";
  if (unread.count === 0) summary = "Bạn đã đọc hết thông báo.";
  else if (unread.count !== undefined)
    summary =
      unread.count > 99
        ? "Hơn 99 thông báo chưa đọc"
        : `${unread.count} thông báo chưa đọc`;
  const hasUnread =
    (unread.count ?? 0) > 0 ||
    query.items.some((item) => !item.readAt && !readIds.has(item.id));

  return (
    <div className={styles.screen}>
      <PageHeading
        title="Thông báo"
        description={summary}
        action={
          <div className={styles.toolbar}>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={busy || !hasUnread}
              onClick={() => void markRead()}
              loading={!!busy}
            >
              <ProductIcon name="check" size={17} />
              {reading === "all" ? "Đang đánh dấu…" : "Đọc tất cả"}
            </LoadingButton>
            <LoadingButton
              type="button"
              className={`btn ${styles.refresh}`}
              aria-label="Làm mới thông báo"
              title="Làm mới"
              disabled={busy || query.loading || unread.refreshing}
              onClick={() => {
                query.reload();
                void unread.reload();
                setNotice("");
                setError(undefined);
              }}
              loading={!!(busy || query.loading)}
            >
              <ProductIcon name="refresh" size={18} />
            </LoadingButton>
          </div>
        }
      />
      <details
        className={styles.settings}
        onToggle={(event) => setSettings(event.currentTarget.open)}
      >
        <summary>
          Cài đặt thông báo <ProductIcon name="chevron" size={16} />
        </summary>
        {settings && (
          <div className={styles.settingsBody}>
            <NotificationPreferences />
            <WebPushSettings />
          </div>
        )}
      </details>
      <Feedback
        loading={query.initialLoading && !query.items.length}
        error={query.error}
        reload={query.reload}
        refreshing={
          !!(query.loading && !(query.initialLoading && !query.items.length))
        }
      />
      {error && (
        <p className="learner-error" role="alert">
          {error}
        </p>
      )}
      <output className={styles.notice}>{notice}</output>
      <section
        className={styles.inbox}
        aria-label="Danh sách thông báo"
        aria-busy={query.loading || busy}
      >
        {query.items.map((item) => {
          const href = notificationDestination(item.payload);
          const copy = notificationCopy(item);
          const isUnread = !item.readAt && !readIds.has(item.id);
          return (
            <article
              className={styles.row}
              data-unread={isUnread}
              key={item.id}
            >
              <span className={styles.icon}>
                <ProductIcon name="notification" size={20} />
              </span>
              <div className={styles.content}>
                <div className={styles.heading}>
                  <h2>{copy.title}</h2>
                  {isUnread && (
                    <>
                      <span className={styles.dot} aria-hidden="true" />
                      <span className="sr-only">Chưa đọc</span>
                    </>
                  )}
                </div>
                <p>{copy.body}</p>
                <time dateTime={item.createdAt}>
                  {formatTime(item.createdAt)}
                </time>
              </div>
              <div className={styles.actions}>
                {href && (
                  <Link
                    className={styles.detail}
                    href={href}
                    aria-label={`Xem chi tiết: ${copy.title}`}
                  >
                    Xem <ProductIcon name="arrow" size={15} />
                  </Link>
                )}
                {isUnread && (
                  <LoadingButton
                    type="button"
                    className={styles.markRead}
                    disabled={busy}
                    aria-label={`Đánh dấu đã đọc: ${copy.title}`}
                    title="Đánh dấu đã đọc"
                    onClick={() => void markRead(item.id)}
                    loading={!!busy}
                  >
                    <ProductIcon name="check" size={17} />
                  </LoadingButton>
                )}
              </div>
            </article>
          );
        })}
        {!query.loading && !query.error && !query.items.length && (
          <div className={styles.empty}>
            <ProductIcon name="notification" size={32} />
            <Empty>Bạn chưa có thông báo.</Empty>
            <p>Thông báo mới sẽ xuất hiện tại đây.</p>
          </div>
        )}
        {query.items.length > 0 && <ListPagination query={query} />}
      </section>
    </div>
  );
}
