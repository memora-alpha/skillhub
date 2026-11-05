"use client";
import { useState, useSyncExternalStore } from "react";
import { useUserSession } from "../auth/session";
import {
  enableWebPush,
  disableWebPush,
  pushBinding,
  pushConfigured,
} from "./web-push";
export function WebPushSettings() {
  const { actor } = useUserSession();
  const enabled = useSyncExternalStore(
    subscribePush,
    () =>
      pushBinding()?.userId === actor.userId &&
      "Notification" in window &&
      Notification.permission === "granted",
    () => false,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  if (!pushConfigured && !enabled) return null;
  return (
    <div className="learner-actions">
      <span>Thông báo trình duyệt</span>
      {error && (
        <p role="alert" className="learner-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn"
        aria-label={
          enabled ? "Tắt thông báo trình duyệt" : "Bật thông báo trình duyệt"
        }
        disabled={busy || (!pushConfigured && !enabled)}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError(undefined);
          try {
            if (enabled) await disableWebPush(actor.userId);
            else await enableWebPush(actor.userId);
            window.dispatchEvent(new Event("skillhub-push-changed"));
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Không thể cập nhật thông báo.",
            );
            window.dispatchEvent(new Event("skillhub-push-changed"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang cập nhật…" : enabled ? "Tắt" : "Bật"}
      </button>
    </div>
  );
}

function subscribePush(listener: () => void) {
  window.addEventListener("focus", listener);
  window.addEventListener("storage", listener);
  window.addEventListener("skillhub-push-changed", listener);
  return () => {
    window.removeEventListener("focus", listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("skillhub-push-changed", listener);
  };
}
