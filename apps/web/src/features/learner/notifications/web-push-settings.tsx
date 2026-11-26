"use client";
import { LoadingButton } from "@/components/loading-button";
import { useState, useSyncExternalStore } from "react";
import { useUserSession } from "../auth/session";
import {
  enableWebPush,
  disableWebPush,
  pushBinding,
  pushConfigured,
  type PushRequest,
} from "./web-push";
export function WebPushSettings() {
  const { actor } = useUserSession();
  return <WebPushSettingsForUser userId={actor.userId} />;
}
export function WebPushSettingsForUser({
  userId,
  request,
}: Readonly<{ userId: string; request?: PushRequest }>) {
  const enabled = useSyncExternalStore(
    subscribePush,
    () =>
      pushBinding()?.userId === userId &&
      "Notification" in window &&
      Notification.permission === "granted",
    () => false,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  if (!pushConfigured && !enabled) return null;
  const actionLabel = enabled ? "Tắt" : "Bật";
  return (
    <div className="learner-actions">
      <span>Thông báo trình duyệt</span>
      {error && (
        <p role="alert" className="learner-error">
          {error}
        </p>
      )}
      <LoadingButton
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
            if (enabled) await disableWebPush(userId, request);
            else await enableWebPush(userId, false, request);
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
        loading={!!busy}
      >
        {busy ? "Đang cập nhật…" : actionLabel}
      </LoadingButton>
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
