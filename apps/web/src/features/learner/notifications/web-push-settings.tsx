"use client";
import { useState, useSyncExternalStore } from "react";
import { useUserSession } from "../auth/session";
import { Panel } from "../components/common";
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
  return (
    <Panel title="Thông báo trên trình duyệt">
      <p>
        Nhận nhắc lịch và cập nhật khi không mở trang SkillHub. Thiết bị dùng
        chung sẽ theo tài khoản đang đăng nhập.
      </p>
      {!pushConfigured && (
        <p className="learner-notice">
          Thông báo đẩy chưa được cấu hình trên bản web này. Thông báo trong ứng
          dụng vẫn hoạt động.
        </p>
      )}
      {error && (
        <p role="alert" className="learner-error">
          {error}
        </p>
      )}
      <button
        className="btn"
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
                : "Không thể cập nhật push.",
            );
            window.dispatchEvent(new Event("skillhub-push-changed"));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Đang cập nhật…"
          : enabled
            ? "Tắt thông báo trên trình duyệt này"
            : "Bật thông báo trên trình duyệt này"}
      </button>
    </Panel>
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
