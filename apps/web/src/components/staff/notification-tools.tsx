"use client";
import { useEffect, useRef, useState } from "react";
import { LoadingButton } from "@/components/loading-button";
import { useStaffResource, useStaffTask } from "./hooks";
import { useStaffSession } from "./session";
import { useNotificationInbox } from "./notification-session";
import { markAllNotificationsRead } from "@/features/learner/notifications/mark-notifications-read";
import { WebPushSettingsForUser } from "@/features/learner/notifications/web-push-settings";

type Preferences = { learning: boolean; credit: boolean; community: boolean };
export function StaffNotificationTools() {
  const { api, actor } = useStaffSession();
  const queue = useNotificationInbox();
  const task = useStaffTask();
  const [open, setOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const preferences = useStaffResource<Preferences>(
    "me/notification-preferences",
    { enabled: open },
  );
  return (
    <div className="stack">
      <LoadingButton
        type="button"
        className="btn"
        loading={task.busy}
        disabled={queue.loading || !!queue.pendingId}
        onClick={() =>
          void task.run(async () => {
            controller.current?.abort();
            const current = new AbortController();
            controller.current = current;
            const result = await markAllNotificationsRead(
              async (path, signal) => {
                const reply = await api<
                  { id: string; readAt: string | null }[]
                >(path, { signal });
                return { ...reply, success: true };
              },
              (id, signal) =>
                api(`notifications/${id}/read`, { method: "PATCH", signal }),
              current.signal,
            );
            if (!current.signal.aborted) await queue.inbox.reload();
            if (!result.complete)
              throw new Error(
                "Một số thông báo chưa đánh dấu được. Bạn có thể thử lại để tiếp tục.",
              );
          })
        }
      >
        Đánh dấu tất cả đã đọc
      </LoadingButton>
      {task.error && (
        <p className="staff-error" role="alert">
          {task.error}
        </p>
      )}
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Cài đặt thông báo</summary>
        {preferences.error && <p role="alert">{preferences.error}</p>}
        {preferences.data && (
          <div className="stack">
            {(
              [
                ["learning", "Học tập"],
                ["credit", "Credit & thanh toán"],
                ["community", "Cộng đồng"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={preferences.data![key]}
                  disabled={task.busy || preferences.loading}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    void task.run(async () => {
                      await api("me/notification-preferences", {
                        method: "PATCH",
                        body: { [key]: checked },
                      });
                      await preferences.reload();
                    });
                  }}
                />{" "}
                {label}
              </label>
            ))}
          </div>
        )}
        {actor && (
          <WebPushSettingsForUser userId={actor.userId} request={api} />
        )}
      </details>
    </div>
  );
}
