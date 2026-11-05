"use client";
import { useEffect } from "react";
import { useUserSession } from "../auth/session";
import {
  pushBinding,
  pushConfigured,
  enableWebPush,
  disableWebPush,
} from "./web-push";
export function WebPushLifecycle() {
  const { actor, refresh } = useUserSession();
  useEffect(() => {
    let pending = false,
      alive = true;
    const received = (event: MessageEvent) => {
      if (event.data?.type === "SKILLHUB_PUSH_RECEIVED") refresh();
      if (event.data?.type === "SKILLHUB_PUSH_EXPIRED")
        void disableWebPush(actor.userId).catch(() => undefined);
    };
    const renew = () => {
      if (pending || !alive) return;
      const binding = pushBinding();
      if (!binding) return;
      pending = true;
      let work = Promise.resolve();
      if (
        binding.userId !== actor.userId ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      )
        work = disableWebPush(actor.userId);
      else if (pushConfigured) work = enableWebPush(actor.userId, true);
      void work
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    };
    navigator.serviceWorker?.addEventListener("message", received);
    window.addEventListener("focus", renew);
    renew();
    return () => {
      alive = false;
      window.removeEventListener("focus", renew);
      navigator.serviceWorker?.removeEventListener("message", received);
    };
  }, [actor.userId, refresh]);
  return null;
}
